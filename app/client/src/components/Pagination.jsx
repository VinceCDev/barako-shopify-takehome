import { ChevronLeftIcon, ChevronRightIcon } from '@shopify/polaris-icons';

/*
 * DOCU: A small "Showing X–Y of Z" footer with Prev/Next controls,
 * shared by every list page's table. Pure presentational — the caller
 * owns the current page state and slices its own data; this just
 * renders the summary text and emits page-change events.
 * @param {Object} props
 * @param {number} props.page - The current 1-indexed page.
 * @param {number} props.pageSize - How many rows per page.
 * @param {number} props.totalItems - Total rows across all pages.
 * @param {Function} props.onPageChange - Called with the new page number.
 * @returns {JSX.Element|null}
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export default function Pagination({ page, pageSize, totalItems, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);

  return (
    <div className="bmt-table-footer">
      <span>
        Showing {start}–{end} of {totalItems}
      </span>
      <div className="bmt-pagination">
        <button
          type="button"
          className="bmt-pagination-btn"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon style={{ width: 16, height: 16, fill: 'currentColor' }} />
        </button>
        <span aria-live="polite" aria-atomic="true">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="bmt-pagination-btn"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon style={{ width: 16, height: 16, fill: 'currentColor' }} />
        </button>
      </div>
    </div>
  );
}
