export * from "./stateModel.js";
export * from "./leader.js";
export * from "./strategyConfig.js";
import mockMatch from "../mock-match.json" with { type: "json" };
import type { MatchState } from "./stateModel.js";
export const MOCK_MATCH = mockMatch as unknown as MatchState;
