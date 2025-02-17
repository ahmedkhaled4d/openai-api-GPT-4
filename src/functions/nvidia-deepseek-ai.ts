import OpenAI from "openai";

const openai = new OpenAI({
  apiKey:
    "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",
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export default async () => {
  const completion = await openai.chat.completions.create({
    model: "deepseek-ai/deepseek-r1",
    messages: [
      { role: "user", content: "Which number is larger, 9.11 or 9.8?" },
    ],
    temperature: 0.6,
    top_p: 0.7,
    max_tokens: 4096,
    stream: true,
  });

  for await (const chunk of completion) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
};
