import OpenAI from "openai";

import { env } from "./config/env";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY, // This is the default and can be omitted
});

async function main() {
  try {
    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      messages: [{ role: "user", content: "Say this is a test" }],
      model: "gpt-3.5-turbo",
    };
    const chatCompletion: OpenAI.Chat.ChatCompletion =
      await openai.chat.completions.create(params);

    console.log(chatCompletion);
  } catch (e) {
    console.error(e);
  }
}
main();
