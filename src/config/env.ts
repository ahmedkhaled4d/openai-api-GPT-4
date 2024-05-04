import { load } from "ts-dotenv";

const env = load({
  API_KEY: String,
});

export { env };
