import {hasEditableSplitExpenseLeft} from '@userActions/IOU/SplitTransactionUpdate';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, Transaction} from '@src/types/onyx';
import type {SplitExpense} from '@src/types/onyx/IOU';

import type {OnyxCollection} from 'react-native-onyx';

import {createRandomReport} from '../utils/collections/reports';
import createRandomTransaction from '../utils/collections/transaction';

const REJECTED_SPLIT_ID = 'rejectedSplit';
const SUBMITTER_OPEN_REPORT_ID = 'submitterOpenReport';

const rejectedSplit: SplitExpense = {
    transactionID: REJECTED_SPLIT_ID,
    amount: 500,
    created: '2026-10-11',
    reportID: SUBMITTER_OPEN_REPORT_ID,
};

const allTransactions: OnyxCollection<Transaction> = {
    [`${ONYXKEYS.COLLECTION.TRANSACTION}${REJECTED_SPLIT_ID}`]: {...createRandomTransaction(1), transactionID: REJECTED_SPLIT_ID, reportID: SUBMITTER_OPEN_REPORT_ID},
};

const allReports: OnyxCollection<Report> = {
    [`${ONYXKEYS.COLLECTION.REPORT}${SUBMITTER_OPEN_REPORT_ID}`]: {
        ...createRandomReport(1, undefined),
        reportID: SUBMITTER_OPEN_REPORT_ID,
        stateNum: CONST.REPORT.STATE_NUM.OPEN,
        statusNum: CONST.REPORT.STATUS_NUM.OPEN,
    },
};

describe('hasEditableSplitExpenseLeft', () => {
    it('treats an open-report split as editable when the editor does not lock it', () => {
        // Given the only remaining split sits on an OPEN report and the split editor did not lock it
        // When deciding whether removing the other split should revert the split
        const result = hasEditableSplitExpenseLeft([rejectedSplit], allTransactions, allReports, undefined, new Set());

        // Then it counts as editable, so a normal 2-way split still collapses back via the reverse split
        expect(result).toBe(true);
    });

    it('does not treat a split the editor locked for this user as editable', () => {
        // Given an approver rejected this split, so it moved to the submitter's OPEN report and the editor shows it locked
        // When the approver removes the other split and only the rejected one is left
        const result = hasEditableSplitExpenseLeft([rejectedSplit], allTransactions, allReports, undefined, new Set([REJECTED_SPLIT_ID]));

        // Then it must not count as editable, so the save never fires REVERT_SPLIT_TRANSACTION on a transaction the approver can't touch
        expect(result).toBe(false);
    });
});
