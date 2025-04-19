// hooks/usePagination.ts
import { useMemo } from 'react';

export const DOTS = '...';

const range = (start: number, end: number): number[] => {
  const length = end - start + 1;
  /*
  	Create an array of certain length and set the elements within it from
  	start value to end value.
  */
  return Array.from({ length }, (_, idx) => idx + start);
};

interface UsePaginationProps {
  totalCount: number; // Total number of items
  pageSize: number; // Items per page
  siblingCount?: number; // Number of page buttons on each side of the current page button
  currentPage: number; // The current active page
}

/**
 * Generates a pagination range array.
 * Aims to show roughly 14 buttons maximum (including first, last, current, siblings, and dots).
 * This is primarily controlled by the siblingCount.
 */
export const usePagination = ({
  totalCount,
  pageSize,
  /**
   * Number of page buttons shown on each side of the current page button.
   * Defaulting to 4 siblings aims for a total of around:
   * 1 (first) + 1 (dots) + 4 (left siblings) + 1 (current) + 4 (right siblings) + 1 (dots) + 1 (last) = 13 buttons
   * in the most complex case (dots on both sides).
   * Adjust this value to control the total number of visible page buttons.
   */
  siblingCount = 6,
  currentPage,
}: UsePaginationProps): (number | string)[] => {
  const paginationRange = useMemo(() => {
    const totalPageCount = Math.ceil(totalCount / pageSize);

    // Pages count is determined as siblingCount + firstPage + lastPage + currentPage + 2*DOTS
    // This represents the minimum number of elements needed to justify showing dots.
    // Calculation: 1 (first) + 1 (left dots) + siblingCount + 1 (current) + siblingCount + 1 (right dots) + 1 (last) = 5 + 2 * siblingCount
    const totalPageNumbersToShow = 5 + 2 * siblingCount;

    /*
      Case 1: If the number of pages is less than the page numbers we want to show in paginationComponent,
      we return the range [1..totalPageCount] without any dots.
    */
    if (totalPageNumbersToShow >= totalPageCount) {
      return range(1, totalPageCount);
    }

    /*
    	Calculate left and right sibling index and make sure they are within the valid range [1..totalPageCount].
    */
    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(
      currentPage + siblingCount,
      totalPageCount
    );

    /*
      We do not show dots just when there is only one page number to be inserted
      between the extremes of sibling and the page limits (1 and totalPageCount).
      Example: If siblingCount is 1, and totalPageCount is 5, currentPage 2: [1, 2, 3, ..., 5] -> No left dots needed (leftSiblingIndex=1)
      Example: If siblingCount is 1, and totalPageCount is 5, currentPage 4: [1, ..., 3, 4, 5] -> No right dots needed (rightSiblingIndex=5)

      Condition for left dots: Need space between first page (1) and left sibling. (leftSiblingIndex > 2)
      Condition for right dots: Need space between right sibling and last page. (rightSiblingIndex < totalPageCount - 1)
    */
    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPageCount - 1;

    const firstPageIndex = 1;
    const lastPageIndex = totalPageCount;

    /*
    	Case 2: No left dots to show, but right dots are needed.
      Example: [1, 2, 3, 4, 5, ..., 10] (current page is likely 1, 2, 3 or 4 if siblingCount=1)
    */
    if (!shouldShowLeftDots && shouldShowRightDots) {
      // How many page numbers to show on the left side?
      // It should include the first page, the current page, and all siblings up to the right sibling index, plus potentially some buffer.
      // Let's calculate based on the right boundary condition: we need space for `last page` and `dots`.
      // The visible range should go up to `currentPage + siblingCount` or slightly more to fill the space.
      // The original logic used a fixed count `3 + 2 * siblingCount`. Let's test this with siblingCount=4 -> 3 + 8 = 11.
      // Range [1...11], DOTS, lastPage. Total = 11 + 1 + 1 = 13. This seems correct and fits the target.
      let leftItemCount = 3 + 2 * siblingCount;
      let leftRange = range(1, leftItemCount);

      return [...leftRange, DOTS, lastPageIndex];
    }

    /*
    	Case 3: No right dots to show, but left dots are needed.
      Example: [1, ..., 6, 7, 8, 9, 10] (current page is likely 7, 8, 9 or 10 if siblingCount=1)
    */
    if (shouldShowLeftDots && !shouldShowRightDots) {
      // How many page numbers to show on the right side?
      // Similar logic to Case 2, but from the end.
      // The original logic used `3 + 2 * siblingCount`. With siblingCount=4 -> 11.
      // Range starts at `totalPageCount - rightItemCount + 1`.
      // Result: firstPage, DOTS, [n-10, ..., n]. Total = 1 + 1 + 11 = 13. Correct.
      let rightItemCount = 3 + 2 * siblingCount;
      let rightRange = range(
        totalPageCount - rightItemCount + 1,
        totalPageCount
      );
      return [firstPageIndex, DOTS, ...rightRange];
    }

    /*
    	Case 4: Both left and right dots to be shown.
      Example: [1, ..., 4, 5, 6, ..., 10] (current page is 5 if siblingCount=1)
    */
    if (shouldShowLeftDots && shouldShowRightDots) {
      let middleRange = range(leftSiblingIndex, rightSiblingIndex);
      // Result: firstPage, DOTS, [leftSibling...rightSibling], DOTS, lastPage.
      // Number of elements in middleRange = rightSiblingIndex - leftSiblingIndex + 1
      // Example: currentPage=10, siblingCount=4. left=6, right=14. middleRange = [6,7,8,9,10,11,12,13,14] (9 elements)
      // Total = 1 (first) + 1 (dots) + (2*siblingCount + 1) + 1 (dots) + 1 (last)
      // Total = 1 + 1 + (2*4 + 1) + 1 + 1 = 2 + 9 + 2 = 13. Correct.
      return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex];
    }

     // Fallback case - should ideally not be reached if logic above is exhaustive
     // but added for safety. Returns all pages if somehow missed by other cases.
     console.warn("usePagination: Reached fallback case, returning full range.");
     return range(1, totalPageCount);

  }, [totalCount, pageSize, siblingCount, currentPage]);

  return paginationRange || []; // Ensure an array is always returned
};
