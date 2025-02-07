import { Client } from "langsmith";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import type { EvaluationResult } from "langsmith/evaluation";
import { evaluate } from "langsmith/evaluation";
import { env } from "../config/env";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY, // This is the default and can be omitted
});

// Define the application logic you want to evaluate inside a target function
// The SDK will automatically send the inputs from the dataset to your target function
async function target(inputs: string): Promise<{ response: string }> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Answer the following question accurately" },
      { role: "user", content: inputs },
    ],
  });
  return { response: response.choices[0].message.content?.trim() || "" };
}

// Define instructions for the LLM judge evaluator
const instructions = `Evaluate Student Answer against Ground Truth for conceptual similarity and classify true or false: 
- False: No conceptual match and similarity
- True: Most or full conceptual match and similarity
- Key criteria: Concept should match, not exact wording.
`;

// Define context for the LLM judge evaluator
const context = `Ground Truth answer: {reference}; Student's Answer: {prediction}`;

// Define output schema for the LLM judge
const ResponseSchema = z.object({
  score: z
    .boolean()
    .describe(
      "Boolean that indicates whether the response is accurate relative to the reference answer"
    ),
});

// Define LLM judge that grades the accuracy of the response relative to reference output
async function accuracy({
  outputs,
  referenceOutputs,
}: {
  outputs?: Record<string, string>;
  referenceOutputs?: Record<string, string>;
}): Promise<EvaluationResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: instructions },
      {
        role: "user",
        content: context
          .replace("{prediction}", outputs?.answer || "")
          .replace("{reference}", referenceOutputs?.answer || ""),
      },
    ],
    response_format: zodResponseFormat(ResponseSchema, "response"),
  });

  return {
    key: "accuracy",
    score: ResponseSchema.parse(
      JSON.parse(response.choices[0].message.content || "")
    ).score,
  };
}

export default async () => {
  const client = new Client();

  // For other dataset creation methods, see: https://docs.smith.langchain.com/evaluation/how_to_guides/manage_datasets_programmatically https://docs.smith.langchain.com/evaluation/how_to_guides/manage_datasets_in_application

  // Create inputs and reference outputs
  const examples: [string, string][] = [
    [
      "Which country is Mount Kilimanjaro located in?",
      "Mount Kilimanjaro is located in Tanzania.",
    ],
    ["What is Earth's lowest point?", "Earth's lowest point is The Dead Sea."],
  ];

  const inputs = examples.map(([inputPrompt]) => ({
    question: inputPrompt,
  }));
  const outputs = examples.map(([, outputAnswer]) => ({
    answer: outputAnswer,
  }));

  // Programmatically create a dataset in LangSmith
  const dataset = await client.createDataset("hr-dataset", {
    description: "A sample dataset in LangSmith.",
  });

  // Add examples to the dataset
  await client.createExamples({
    inputs,
    outputs,
    datasetId: dataset.id,
  });

  // After running the evaluation, a link will be provided to view the results in langsmith
  await evaluate(
    (exampleInput) => {
      return target(exampleInput.question);
    },
    {
      data: "hr-dataset",
      evaluators: [
        accuracy,
        // can add multiple evaluators here
      ],
      experimentPrefix: "first-eval-in-langsmith",
      maxConcurrency: 2,
    }
  );
};
