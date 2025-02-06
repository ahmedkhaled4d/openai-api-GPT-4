import OpenAI from "openai";
import { env } from "../config/env";
import fs from "fs";
import { FineTuningJobEvent } from "openai/resources/fine-tuning/jobs/jobs";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY, // This is the default and can be omitted
});

export default async function main() {
  console.log(`Uploading file`);

  let file = await openai.files.create({
    file: fs.createReadStream("./src/data/qa.jsonl"),
    purpose: "fine-tune",
  });
  console.log(`Uploaded file with ID: ${file.id}`);

  console.log("-----");

  console.log(`Waiting for file to be processed`);
  while (true) {
    file = await openai.files.retrieve(file.id);
    console.log(`File status: ${file.status}`);

    if (file.status === "processed") {
      break;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log("-----");

  console.log(`Starting fine-tuning`);
  let fineTune = await openai.fineTuning.jobs.create({
    model: "gpt-3.5-turbo",
    training_file: file.id,
  });
  console.log(`Fine-tuning ID: ${fineTune.id}`);

  console.log("-----");

  console.log(`Track fine-tuning progress:`);

  const events: Record<string, FineTuningJobEvent> = {};

  while (fineTune.status == "running" || fineTune.status == "queued") {
    fineTune = await openai.fineTuning.jobs.retrieve(fineTune.id);
    console.log(`${fineTune.status}`);

    const { data } = await openai.fineTuning.jobs.listEvents(fineTune.id, {
      limit: 100,
    });
    for (const event of data.reverse()) {
      if (event.id in events) continue;
      events[event.id] = event;
      const timestamp = new Date(event.created_at * 1000);
      console.log(`- ${timestamp.toLocaleTimeString()}: ${event.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
