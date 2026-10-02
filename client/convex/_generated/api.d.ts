/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as bnr from "../bnr.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as laya from "../laya.js";
import type * as oferte_actions from "../oferte/actions.js";
import type * as oferte_excel from "../oferte/excel.js";
import type * as oferte_mutations from "../oferte/mutations.js";
import type * as oferte_queries from "../oferte/queries.js";
import type * as oferte_review from "../oferte/review.js";
import type * as queries from "../queries.js";
import type * as types_index from "../types/index.js";
import type * as typesense from "../typesense.js";
import type * as yahooFinance from "../yahooFinance.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bnr: typeof bnr;
  crons: typeof crons;
  http: typeof http;
  laya: typeof laya;
  "oferte/actions": typeof oferte_actions;
  "oferte/excel": typeof oferte_excel;
  "oferte/mutations": typeof oferte_mutations;
  "oferte/queries": typeof oferte_queries;
  "oferte/review": typeof oferte_review;
  queries: typeof queries;
  "types/index": typeof types_index;
  typesense: typeof typesense;
  yahooFinance: typeof yahooFinance;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
