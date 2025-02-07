import { OpenAI } from "openai";
import { traceable } from "langsmith/traceable";
import { wrapOpenAI } from "langsmith/wrappers";
import { env } from "../config/env";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY, // This is the default and can be omitted
});

// Out: Hello there! How can I assist you today?
export default async () => {
  // Auto-trace LLM calls in-context
  const client = wrapOpenAI(openai);
  // Auto-trace this function
  const pipeline = traceable(async () => {
    const result = await client.chat.completions.create({
      messages: [{ role: "user", content: "Hello, world!" }],
      model: "gpt-3.5-turbo",
    });
    return result.choices[0].message.content;
  });

  const res = await pipeline();
  console.log(res);
};
