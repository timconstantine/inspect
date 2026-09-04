import type { RawNode } from '@/entities/snapshot/types';
import { FastQuery, type QueryResult } from '@gkd-kit/selector';
import type { ResolvedSelector } from '../../entities/selector/parser.ts';

import type { FastQueryEvidence } from './search_types';

const getQueryContextNode = (
  result: QueryResult<RawNode>,
): RawNode | undefined => result.context.toArray().at(-1);

export const getFastQueryEvidence = (
  selector: ResolvedSelector,
  results: QueryResult<RawNode>[],
): FastQueryEvidence => {
  if (selector.fastQueryList.length == 0) {
    return {
      status: 'unsupported',
      label: 'Fast query not enabled',
      reason: `The selector has no expression that can be converted into an id, vid, or text fast-query condition.`,
    };
  }

  for (const result of results) {
    const node = getQueryContextNode(result);
    if (!node) continue;
    if (
      (node.quickFind || node.idQf) &&
      node.attr.id &&
      selector.fastQueryList.some(
        (query) =>
          query instanceof FastQuery.Id && query.acceptText(node.attr.id!),
      )
    ) {
      return {
        status: 'supported',
        label: 'id fast query available',
        reason: `The target node's id "${node.attr.id}" matches the selector's fast-query condition.`,
      };
    }
    if (
      (node.quickFind || node.idQf) &&
      node.attr.vid &&
      selector.fastQueryList.some(
        (query) =>
          query instanceof FastQuery.Vid && query.acceptText(node.attr.vid!),
      )
    ) {
      return {
        status: 'supported',
        label: 'vid fast query available',
        reason: `The target node's vid "${node.attr.vid}" matches the selector's fast-query condition.`,
      };
    }
    if (
      (node.quickFind || node.textQf) &&
      node.attr.text &&
      selector.fastQueryList.some(
        (query) =>
          query instanceof FastQuery.Text && query.acceptText(node.attr.text!),
      )
    ) {
      return {
        status: 'supported',
        label: 'text fast query available',
        reason: `The target node's text matches the selector's fast-query condition.`,
      };
    }
  }

  return {
    status: 'unknown',
    label: 'Fast query unconfirmed',
    reason: `The selector includes a fast-query condition, but the current match target has no corresponding quickFind marker; the snapshot alone can't confirm whether the client runtime will use fast query.`,
  };
};
