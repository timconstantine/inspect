import type { RawNode, Snapshot } from '@/entities/snapshot/types';
import JSON5 from 'json5';
import { parseSelector } from '../../entities/selector/parser.ts';

type JsonObject = Record<string, unknown>;

interface RuleCandidate {
  group?: JsonObject;
  path: string;
  rule: JsonObject;
}

export interface RuleDiagnosticDetails {
  matchedSelectors: string[];
  rejectedSelectors: string[];
  rulePath?: string;
}

export type RuleDiagnostic =
  | { status: 'empty' }
  | { status: 'invalid'; message: string }
  | {
      status: 'not-matched';
      message: string;
      details: RuleDiagnosticDetails;
      notes: string[];
    }
  | {
      status: 'matched';
      message: string;
      targetNode: RawNode;
      details: RuleDiagnosticDetails;
      notes: string[];
    };

export const getRuleDiagnosticPresentation = (
  diagnostic: RuleDiagnostic,
): {
  type: 'default' | 'error' | 'success' | 'warning';
  label: string;
} => {
  if (diagnostic.status == 'matched') {
    return diagnostic.notes.length
      ? { type: 'warning', label: 'Partially verified' }
      : { type: 'success', label: 'Statically matched' };
  }
  if (diagnostic.status == 'not-matched') {
    return { type: 'default', label: 'Not matched' };
  }
  if (diagnostic.status == 'invalid') {
    return { type: 'error', label: 'Format error' };
  }
  return { type: 'default', label: 'Waiting for input' };
};

const isObject = (value: unknown): value is JsonObject =>
  typeof value == 'object' && value != null && !Array.isArray(value);

const toStringArray = (
  value: unknown,
  field: string,
): { values?: string[]; error?: string } => {
  if (value == null) return { values: [] };
  if (typeof value == 'string') return { values: [value] };
  if (Array.isArray(value) && value.every((item) => typeof item == 'string')) {
    return { values: value };
  }
  return { error: `${field} must be a string or an array of strings` };
};

const hasOwn = (value: JsonObject, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

const inheritedValue = (
  rule: JsonObject,
  group: JsonObject | undefined,
  key: string,
) => (hasOwn(rule, key) ? rule[key] : group?.[key]);

const normalizeActivityId = (appId: string, activityId: string) =>
  activityId.startsWith('.') ? appId + activityId : activityId;

type ActivityDiagnostic =
  | { status: 'valid' }
  | { status: 'invalid' | 'mismatch'; message: string };

const matchActivity = (
  snapshot: Snapshot,
  rule: JsonObject,
  group?: JsonObject,
): ActivityDiagnostic => {
  const activityResult = toStringArray(
    inheritedValue(rule, group, 'activityIds'),
    'activityIds',
  );
  if (activityResult.error) {
    return { status: 'invalid', message: activityResult.error };
  }
  const excludeResult = toStringArray(
    inheritedValue(rule, group, 'excludeActivityIds'),
    'excludeActivityIds',
  );
  if (excludeResult.error) {
    return { status: 'invalid', message: excludeResult.error };
  }

  if (
    excludeResult.values?.some((value) =>
      snapshot.activityId.startsWith(
        normalizeActivityId(snapshot.appId, value),
      ),
    )
  ) {
    return {
      status: 'mismatch',
      message: `Current screen ${snapshot.activityId} is excluded by excludeActivityIds`,
    };
  }
  if (
    activityResult.values?.length &&
    !activityResult.values.some((value) =>
      snapshot.activityId.startsWith(
        normalizeActivityId(snapshot.appId, value),
      ),
    )
  ) {
    return {
      status: 'mismatch',
      message: `Current screen ${snapshot.activityId} doesn't match activityIds`,
    };
  }
  return { status: 'valid' };
};

const runtimeFieldLabels: Record<string, string> = {
  preKeys: 'Prerequisite rule execution state',
  actionCdKey: 'Shared cooldown state',
  actionMaximumKey: 'Shared execution count',
  actionMaximum: 'Max execution count',
  actionCd: 'Execution cooldown',
  matchDelay: 'Match delay',
  actionDelay: 'Action delay',
  forcedTime: 'Forced match window',
  priorityTime: 'Priority match window',
  priorityActionMaximum: 'Priority execution count',
  versionCode: 'Version code condition',
  versionName: 'Version name condition',
  versionCodes: 'Version code condition',
  versionNames: 'Version name condition',
  excludeVersionCodes: 'Version code exclusion condition',
  excludeVersionNames: 'Version name exclusion condition',
};

const getRuntimeNotes = (rule: JsonObject, group?: JsonObject): string[] => {
  const notes: string[] = [];
  for (const [key, label] of Object.entries(runtimeFieldLabels)) {
    if (inheritedValue(rule, group, key) != null) {
      notes.push(
        `${label} (${key}) depends on runtime state and wasn't verified this time`,
      );
    }
  }
  if (group?.enable === false) {
    notes.push(
      `The rule group is disabled by default; whether it's actually enabled depends on the client configuration`,
    );
  }
  if (rule.enable === false) {
    notes.push(
      `The rule is disabled by default; whether it's actually enabled depends on the client configuration`,
    );
  }
  return notes;
};

const normalizeRule = (value: unknown): JsonObject | undefined => {
  if (typeof value == 'string') return { matches: value };
  return isObject(value) ? value : undefined;
};

const collectGroups = (
  value: unknown,
  basePath: string,
): { candidates?: RuleCandidate[]; error?: string } => {
  const groups = Array.isArray(value) ? value : [value];
  const candidates: RuleCandidate[] = [];
  for (const [groupIndex, groupValue] of groups.entries()) {
    if (!isObject(groupValue)) {
      return { error: `${basePath}[${groupIndex}] must be an object` };
    }
    const rulesValue = groupValue.rules;
    if (rulesValue == null) {
      return { error: `${basePath}[${groupIndex}].rules is missing` };
    }
    const rules = Array.isArray(rulesValue) ? rulesValue : [rulesValue];
    for (const [ruleIndex, ruleValue] of rules.entries()) {
      const rule = normalizeRule(ruleValue);
      if (!rule) {
        return {
          error: `${basePath}[${groupIndex}].rules[${ruleIndex}] must be an object or a string`,
        };
      }
      candidates.push({
        group: groupValue,
        path: `${basePath}[${groupIndex}].rules[${ruleIndex}]`,
        rule,
      });
    }
  }
  return { candidates };
};

const collectCandidates = (
  input: JsonObject,
  snapshot: Snapshot,
): { candidates?: RuleCandidate[]; error?: string; mismatch?: string } => {
  if (input.apps != null) {
    if (!Array.isArray(input.apps)) return { error: 'apps must be an array' };
    const appIndex = input.apps.findIndex(
      (app) => isObject(app) && app.id == snapshot.appId,
    );
    if (appIndex < 0) {
      return {
        mismatch: `apps doesn't contain the current app ${snapshot.appId}`,
      };
    }
    const app = input.apps[appIndex];
    if (!isObject(app)) return { error: `apps[${appIndex}] must be an object` };
    return collectGroups(app.groups, `apps[${appIndex}].groups`);
  }

  if (typeof input.id == 'string' && input.groups != null) {
    if (input.id != snapshot.appId) {
      return {
        mismatch: `Rule app ${input.id} doesn't match the current app ${snapshot.appId}`,
      };
    }
    return collectGroups(input.groups, 'groups');
  }

  if (input.groups != null) return collectGroups(input.groups, 'groups');
  if (input.rules != null) return collectGroups(input, 'group');
  return { candidates: [{ path: 'rule', rule: input }] };
};

const querySelectors = (
  values: string[],
  field: string,
  rootNode: RawNode,
): { results?: RawNode[][]; error?: string } => {
  const results: RawNode[][] = [];
  for (const [index, source] of values.entries()) {
    try {
      results.push(parseSelector(source).querySelfOrSelectorAll(rootNode));
    } catch (error) {
      return {
        error: `${field}[${index}] invalid selector: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }
  return { results };
};

const evaluateCandidate = (
  candidate: RuleCandidate,
  snapshot: Snapshot,
  rootNode: RawNode,
): RuleDiagnostic => {
  const notes = getRuntimeNotes(candidate.rule, candidate.group);
  const activityDiagnostic = matchActivity(
    snapshot,
    candidate.rule,
    candidate.group,
  );
  if (activityDiagnostic.status == 'invalid') {
    return { status: 'invalid', message: activityDiagnostic.message };
  }
  if (activityDiagnostic.status == 'mismatch') {
    return {
      status: 'not-matched',
      message: activityDiagnostic.message,
      details: {
        matchedSelectors: [],
        rejectedSelectors: [],
        rulePath: candidate.path,
      },
      notes,
    };
  }

  const selectorFields = [
    'matches',
    'anyMatches',
    'excludeMatches',
    'excludeAllMatches',
  ] as const;
  const selectorValues = {} as Record<
    (typeof selectorFields)[number],
    string[]
  >;
  for (const field of selectorFields) {
    const result = toStringArray(candidate.rule[field], field);
    if (result.error) return { status: 'invalid', message: result.error };
    selectorValues[field] = result.values ?? [];
  }
  if (!selectorValues.matches.length && !selectorValues.anyMatches.length) {
    return {
      status: 'invalid',
      message: `${candidate.path} needs at least one of matches or anyMatches`,
    };
  }

  const queryResults = {} as Record<
    (typeof selectorFields)[number],
    RawNode[][]
  >;
  for (const field of selectorFields) {
    const result = querySelectors(selectorValues[field], field, rootNode);
    if (result.error) return { status: 'invalid', message: result.error };
    queryResults[field] = result.results ?? [];
  }

  const matchedSelectors: string[] = [];
  const rejectedSelectors: string[] = [];
  queryResults.matches.forEach((nodes, index) =>
    (nodes.length ? matchedSelectors : rejectedSelectors).push(
      `matches[${index}]`,
    ),
  );
  queryResults.anyMatches.forEach((nodes, index) =>
    (nodes.length ? matchedSelectors : rejectedSelectors).push(
      `anyMatches[${index}]`,
    ),
  );
  const details = {
    matchedSelectors,
    rejectedSelectors,
    rulePath: candidate.path,
  };

  const missingMatch = queryResults.matches.findIndex((nodes) => !nodes.length);
  if (missingMatch >= 0) {
    return {
      status: 'not-matched',
      message: `matches[${missingMatch}] has no matching node`,
      details,
      notes,
    };
  }
  if (
    queryResults.anyMatches.length &&
    queryResults.anyMatches.every((nodes) => !nodes.length)
  ) {
    return {
      status: 'not-matched',
      message: 'None of the selectors in anyMatches matched a node',
      details,
      notes,
    };
  }
  const excludeIndex = queryResults.excludeMatches.findIndex(
    (nodes) => nodes.length,
  );
  if (excludeIndex >= 0) {
    return {
      status: 'not-matched',
      message: `excludeMatches[${excludeIndex}] matched an excluded node`,
      details,
      notes,
    };
  }
  if (
    queryResults.excludeAllMatches.length &&
    queryResults.excludeAllMatches.every((nodes) => nodes.length)
  ) {
    return {
      status: 'not-matched',
      message: 'All selectors in excludeAllMatches matched',
      details,
      notes,
    };
  }

  const targetNode = queryResults.matches.length
    ? queryResults.matches.at(-1)![0]
    : queryResults.anyMatches.find((nodes) => nodes.length)?.[0];
  if (!targetNode) {
    return {
      status: 'not-matched',
      message: 'No target node found for the rule',
      details,
      notes,
    };
  }
  return {
    status: 'matched',
    message: notes.length
      ? 'Static conditions matched; runtime conditions are still unverified'
      : 'Static conditions matched',
    targetNode,
    details,
    notes,
  };
};

export const evaluateRuleText = (
  source: string,
  snapshot: Snapshot,
  rootNode: RawNode,
): RuleDiagnostic => {
  if (!source.trim()) return { status: 'empty' };
  let input: unknown;
  try {
    input = JSON5.parse(source);
  } catch (error) {
    return {
      status: 'invalid',
      message: `JSON5 format error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!isObject(input)) {
    return {
      status: 'invalid',
      message: 'Enter a rule, rule group, app, or subscription object',
    };
  }
  const collected = collectCandidates(input, snapshot);
  if (collected.error) return { status: 'invalid', message: collected.error };
  if (collected.mismatch) {
    return {
      status: 'not-matched',
      message: collected.mismatch,
      details: { matchedSelectors: [], rejectedSelectors: [] },
      notes: [],
    };
  }
  const diagnostics = (collected.candidates ?? []).map((candidate) =>
    evaluateCandidate(candidate, snapshot, rootNode),
  );
  const matched = diagnostics.find((result) => result.status == 'matched');
  if (matched) return matched;
  const invalid = diagnostics.find((result) => result.status == 'invalid');
  if (invalid) return invalid;
  return (
    diagnostics[0] ?? {
      status: 'invalid',
      message: 'No rule to diagnose',
    }
  );
};
