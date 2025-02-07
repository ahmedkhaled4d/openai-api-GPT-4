import OpenAI from "openai";
import { env } from "../config/env";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY, // This is the default and can be omitted
});

export default async () => {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "developer", content: "You are a helpful assistant." },
      {
        role: "user",
        content: "Write a haiku about recursion in programming.",
      },
    ],
    store: true,
  });

  // Explicit streaming params type:
  const streaming_params: OpenAI.Chat.ChatCompletionCreateParams = {
    model: "gpt-4",
    messages: [{ role: "user", content: "give me short story about egypt!" }],
    stream: true,
  };

  const stream = await openai.chat.completions.create(streaming_params);
  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
  process.stdout.write("\n");

  console.log(completion.choices[0].message);
};
