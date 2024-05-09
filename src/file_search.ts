import OpenAI from "openai";
import fs from "fs";
const openai = new OpenAI();

export async function fileSearch() {
  const assistant = await openai.beta.assistants.create({
    name: "Financial Analyst Assistant",
    instructions:
      "You are an expert financial analyst. Use you knowledge base to answer questions about audited financial statements.",
    model: "gpt-4-turbo",
    tools: [{ type: "file_search" }],
  });

  const fileStreams = ["edgar/goog-10k.pdf", "edgar/brka-10k.txt"].map((path) =>
    fs.createReadStream(path)
  );

  // Create a vector store including our two files.
  let vectorStore = await openai.beta.vectorStores.create({
    name: "Financial Statement",
  });

  await openai.beta.vectorStores.fileBatches.uploadAndPoll(
    vectorStore.id,
    fileStreams
  );
}
