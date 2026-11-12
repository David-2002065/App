/* eslint-disable @typescript-eslint/no-deprecated -- the split action fixture writes originalMessage, which the backend still sends */
import {act, renderHook} from '@testing-library/react-native';

import useSplitContainerTransaction from '@hooks/useSplitContainerTransaction';

import {openReport} from '@libs/actions/Report';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportAction} from '@src/types/onyx';

import Onyx from 'react-native-onyx';

import createRandomReportAction from '../../utils/collections/reportActions';
import waitForBatchedUpdates from '../../utils/waitForBatchedUpdates';

jest.mock('@libs/actions/Report', () => {
    const actual = jest.requireActual<Record<string, unknown>>('@libs/actions/Report');
    return {
        ...actual,
        openReport: jest.fn(),
    };
});

const CHAT_REPORT_ID = '1001';
const SPLIT_TRANSACTION_ID = '2002';

const splitAction: ReportAction = {
    ...createRandomReportAction(1),
    reportActionID: '3003',
    actionName: CONST.REPORT.ACTIONS.TYPE.IOU,
    originalMessage: {
        type: CONST.IOU.REPORT_ACTION_TYPE.SPLIT,
        IOUTransactionID: SPLIT_TRANSACTION_ID,
        amount: 2000,
        currency: CONST.CURRENCY.USD,
        participantAccountIDs: [1, 2],
    },
};

const setChatLoading = async (isLoadingInitialReportActions: boolean) => {
    await act(async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.RAM_ONLY_REPORT_LOADING_STATE}${CHAT_REPORT_ID}`, {isLoadingInitialReportActions});
        await waitForBatchedUpdates();
    });
};

describe('useSplitContainerTransaction', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        jest.mocked(openReport).mockClear();
        await Onyx.clear();
        await waitForBatchedUpdates();
    });

    it('requests the chat once and stays loading when the container transaction is missing', async () => {
        // Given the chat has loaded but the split's container transaction is gone, like after Reset and refresh
        await setChatLoading(false);

        // When the split details page reads the split
        const {result, rerender} = renderHook(() => useSplitContainerTransaction(CHAT_REPORT_ID, splitAction));
        await waitForBatchedUpdates();
        rerender(undefined);

        // Then it asks for the chat's OpenReport, the only response that carries the container, and doesn't show not-found yet
        expect(openReport).toHaveBeenCalledTimes(1);
        expect(jest.mocked(openReport).mock.calls.at(0)?.at(0)).toMatchObject({reportID: CHAT_REPORT_ID, reportActionID: splitAction.reportActionID, shouldMarkAsRead: false});
        expect(result.current.isLoadingTransaction).toBe(true);
    });

    it('returns the container transaction once the OpenReport response brings it back', async () => {
        // Given the page requested the chat because the container transaction was missing
        await setChatLoading(false);
        const {result} = renderHook(() => useSplitContainerTransaction(CHAT_REPORT_ID, splitAction));
        await waitForBatchedUpdates();

        // When the request runs and its response merges the container transaction
        await setChatLoading(true);
        await act(async () => {
            await Onyx.merge(`${ONYXKEYS.COLLECTION.TRANSACTION}${SPLIT_TRANSACTION_ID}`, {transactionID: SPLIT_TRANSACTION_ID, reportID: CONST.REPORT.SPLIT_REPORT_ID, amount: 2000});
            await waitForBatchedUpdates();
        });
        await setChatLoading(false);

        // Then the page gets the transaction and stops loading
        expect(result.current.transaction?.transactionID).toBe(SPLIT_TRANSACTION_ID);
        expect(result.current.isLoadingTransaction).toBe(false);
        expect(openReport).toHaveBeenCalledTimes(1);
    });

    it('stops loading when the chat finished loading without the container transaction', async () => {
        // Given the page requested the chat because the container transaction was missing
        await setChatLoading(false);
        const {result} = renderHook(() => useSplitContainerTransaction(CHAT_REPORT_ID, splitAction));
        await waitForBatchedUpdates();

        // When that load finishes and the transaction still isn't there, e.g. the split was deleted
        await setChatLoading(true);
        await setChatLoading(false);

        // Then the page can show not-found instead of spinning forever, and it doesn't request again
        expect(result.current.isLoadingTransaction).toBe(false);
        expect(openReport).toHaveBeenCalledTimes(1);
    });

    it('does not request anything when the container transaction is already in Onyx', async () => {
        // Given the container transaction is cached
        await act(async () => {
            await Onyx.merge(`${ONYXKEYS.COLLECTION.TRANSACTION}${SPLIT_TRANSACTION_ID}`, {transactionID: SPLIT_TRANSACTION_ID, reportID: CONST.REPORT.SPLIT_REPORT_ID, amount: 2000});
            await waitForBatchedUpdates();
        });

        // When the split details page reads the split
        const {result} = renderHook(() => useSplitContainerTransaction(CHAT_REPORT_ID, splitAction));
        await waitForBatchedUpdates();

        // Then it uses the cached transaction without fetching the chat
        expect(result.current.transaction?.transactionID).toBe(SPLIT_TRANSACTION_ID);
        expect(result.current.isLoadingTransaction).toBe(false);
        expect(openReport).not.toHaveBeenCalled();
    });
});
