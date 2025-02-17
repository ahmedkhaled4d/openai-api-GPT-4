import fs from "fs";
import axios from "axios";
import path from "path";

const invokeUrl = "https://ai.api.nvidia.com/v1/vlm/nvidia/cosmos-nemotron-34b";
const stream = false;
const query = "Describe the scene";

const kNvcfAssetUrl = "https://api.nvcf.nvidia.com/v2/nvcf/assets";

// Retrieve the API Key from environment variables
const kApiKey = process.env.TEST_NVCF_API_KEY;
if (!kApiKey) {
  console.error("Generate API_KEY and export TEST_NVCF_API_KEY=xxxx");
  process.exit(1);
}

const kSupportedList: { [key: string]: [string, string] } = {
  png: ["image/png", "img"],
  jpg: ["image/jpg", "img"],
  jpeg: ["image/jpeg", "img"],
  mp4: ["video/mp4", "video"],
};

// Get file extension
function getExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return ext.slice(1); // remove the leading dot
}

// Get MIME type
function mimeType(ext: string): string {
  return kSupportedList[ext as keyof typeof kSupportedList][0];
}

// Get media type
function mediaType(ext: string): string {
  return kSupportedList[ext as keyof typeof kSupportedList][1];
}

// Upload asset
interface AuthorizeResponse {
  uploadUrl: string;
  assetId: string;
}

async function uploadAsset(
  mediaFile: string,
  description: string
): Promise<string> {
  const ext = getExtension(mediaFile);
  if (!(ext in kSupportedList)) {
    throw new Error(`Unsupported file extension: ${ext}`);
  }

  const dataInput = fs.readFileSync(mediaFile); // Sync file read

  const headers = {
    Authorization: `Bearer ${kApiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const postData = {
    contentType: mimeType(ext),
    description: description,
  };

  // First API call to authorize asset upload
  const { data: authorizeRes }: { data: AuthorizeResponse } = await axios.post(
    kNvcfAssetUrl,
    postData,
    {
      headers,
    }
  );
  console.log(`uploadUrl: ${authorizeRes.uploadUrl}`);

  // Second API call to upload the file
  const response = await axios.put(authorizeRes.uploadUrl, dataInput, {
    headers: {
      "x-amz-meta-nvcf-asset-description": description,
      "content-type": mimeType(ext),
    },
  });

  if (response.status === 200) {
    console.log(`upload asset_id ${authorizeRes.assetId} successfully!`);
    return authorizeRes.assetId.toString();
  } else {
    console.log(`upload asset_id ${authorizeRes.assetId} failed.`);
    throw new Error(`Asset upload failed: ${authorizeRes.assetId}`);
  }
}

// Delete asset
interface DeleteAssetHeaders {
  Authorization: string;
}

async function deleteAsset(assetId: string): Promise<void> {
  const headers: DeleteAssetHeaders = {
    Authorization: `Bearer ${kApiKey}`,
  };
  const url = `${kNvcfAssetUrl}/${assetId}`;
  await axios.delete(url, { headers });
}

// Chat with media NVCF
interface ChatWithMediaNvcfHeaders {
  Authorization: string;
  "Content-Type": string;
  "NVCF-INPUT-ASSET-REFERENCES": string;
  "NVCF-FUNCTION-ASSET-IDS": string;
  Accept: string;
}

interface Message {
  role: string;
  content: string;
}

interface Payload {
  max_tokens: number;
  temperature: number;
  top_p: number;
  seed: number;
  num_frames_per_inference: number;
  messages: Message[];
  stream: boolean;
  model: string;
}

async function chatWithMediaNvcf(
  inferUrl: string,
  mediaFiles: string[],
  query: string,
  stream: boolean = false
): Promise<void> {
  const assetList: string[] = [];
  const extList: string[] = [];
  let mediaContent = "";
  let hasVideo = false;

  for (const mediaFile of mediaFiles) {
    const ext = getExtension(mediaFile);
    if (!(ext in kSupportedList)) {
      throw new Error(`${mediaFile} format is not supported`);
    }

    if (mediaType(ext) === "video") {
      hasVideo = true;
    }

    console.log(`uploading file: ${mediaFile}`);
    const assetId = await uploadAsset(mediaFile, "Reference media file");
    console.log(`assetId: ${assetId}`);
    assetList.push(assetId);
    extList.push(ext);
    mediaContent += `<${mediaType(ext)} src="data:${mimeType(
      ext
    )};asset_id,${assetId}" />`;
  }

  if (hasVideo && mediaFiles.length !== 1) {
    throw new Error("Only a single video is supported.");
  }

  const assetSeq = assetList.join(",");
  console.log(`received asset_id list: ${assetSeq}`);

  const headers: ChatWithMediaNvcfHeaders = {
    Authorization: `Bearer ${kApiKey}`,
    "Content-Type": "application/json",
    "NVCF-INPUT-ASSET-REFERENCES": assetSeq,
    "NVCF-FUNCTION-ASSET-IDS": assetSeq,
    Accept: "application/json",
  };

  if (stream) {
    headers["Accept"] = "text/event-stream";
  }

  const messages: Message[] = [
    {
      role: "user",
      content: `${query} ${mediaContent}`,
    },
  ];

  const payload: Payload = {
    max_tokens: 1024,
    temperature: 0.2,
    top_p: 0.7,
    seed: 50,
    num_frames_per_inference: 8,
    messages: messages,
    stream: stream,
    model: "nvidia/vila",
  };

  const response = await axios.post(inferUrl, payload, {
    headers: headers,
    responseType: stream ? "stream" : "json",
  });

  if (stream) {
    response.data.on("data", (line: Buffer) => {
      console.log(line.toString());
    });
  } else {
    console.log(JSON.stringify(response.data));
  }

  console.log(`deleting assets: ${assetList}`);
  for (const assetId of assetList) {
    await deleteAsset(assetId);
  }
}

// Main function to run the script
async function main() {
  const args = process.argv.slice(2);
  if (args.length <= 0) {
    console.log("Usage: export TEST_NVCF_API_KEY=xxx");
    console.log(
      `python ${process.argv[0]} sample1.png sample2.png ... sample16.png`
    );
    console.log(`python ${process.argv[0]} sample.mp4`);
    process.exit(1);
  }

  const mediaSamples = args;
  await chatWithMediaNvcf(invokeUrl, mediaSamples, query, stream);
}

main();
