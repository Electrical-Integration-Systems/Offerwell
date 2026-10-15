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
import type * as lib_material_description from "../lib/material_description.js";
import type * as material_prices from "../material_prices.js";
import type * as oferte_actions from "../oferte/actions.js";
import type * as oferte_currency from "../oferte/currency.js";
import type * as oferte_errors from "../oferte/errors.js";
import type * as oferte_excel from "../oferte/excel.js";
import type * as oferte_excel_analysis from "../oferte/excel_analysis.js";
import type * as oferte_excel_styles from "../oferte/excel_styles.js";
import type * as oferte_export_format from "../oferte/export_format.js";
import type * as oferte_mapping from "../oferte/mapping.js";
import type * as oferte_matching from "../oferte/matching.js";
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
  "lib/material_description": typeof lib_material_description;
  material_prices: typeof material_prices;
  "oferte/actions": typeof oferte_actions;
  "oferte/currency": typeof oferte_currency;
  "oferte/errors": typeof oferte_errors;
  "oferte/excel": typeof oferte_excel;
  "oferte/excel_analysis": typeof oferte_excel_analysis;
  "oferte/excel_styles": typeof oferte_excel_styles;
  "oferte/export_format": typeof oferte_export_format;
  "oferte/mapping": typeof oferte_mapping;
  "oferte/matching": typeof oferte_matching;
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
