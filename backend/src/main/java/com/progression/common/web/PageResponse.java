package com.progression.common.web;

import java.util.List;

/**
 * One page of a cursor-paginated list.
 *
 * @param items      the results on this page
 * @param nextCursor opaque token to pass as {@code ?cursor=} for the next page, or {@code null} on the last page
 */
public record PageResponse<T>(List<T> items, String nextCursor) {
}
