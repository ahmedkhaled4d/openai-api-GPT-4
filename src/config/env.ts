import { load } from "ts-dotenv";

const env = load({
  OPENAI_API_KEY: String,
});

export { env };
