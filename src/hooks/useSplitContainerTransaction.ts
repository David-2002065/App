/**
 * Reads the container transaction of a split action and recovers it when it's missing from Onyx.
 * The container lives on SPLIT_REPORT_ID, so after a cache reset only the chat's OpenReport brings it back.
 */
import {openReport} from '@libs/actions/Report';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {getOriginalMessage, isSplitBillAction} from '@libs/ReportActionsUtils';

import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportAction} from '@src/types/onyx';
import {isEmptyObject} from '@src/types/utils/EmptyObject';

import type {OnyxEntry} from 'react-native-onyx';

import {guidedSetupAndTourStatusSelector} from '@selectors/Onboarding';
import {useEffect, useRef, useState} from 'react';

import useCurrentUserPersonalDetails from './useCurrentUserPersonalDetails';
import useOnyx from './useOnyx';

function useSplitContainerTransaction(reportID: string | undefined, reportAction: OnyxEntry<ReportAction>) {
    const IOUTransactionID = isSplitBillAction(reportAction) ? getOriginalMessage(reportAction)?.IOUTransactionID : undefined;
    const [transaction] = useOnyx(`${ONYXKEYS.COLLECTION.TRANSACTION}${getNonEmptyStringOnyxID(IOUTransactionID)}`);
    const [reportLoadingState] = useOnyx(`${ONYXKEYS.COLLECTION.RAM_ONLY_REPORT_LOADING_STATE}${getNonEmptyStringOnyxID(reportID)}`);
    const [introSelected] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED);
    const [conciergeReportID] = useOnyx(ONYXKEYS.CONCIERGE_REPORT_ID);
    const [conciergeChat] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getNonEmptyStringOnyxID(conciergeReportID)}`);
    const [guidedSetupAndTourStatus] = useOnyx(ONYXKEYS.NVP_ONBOARDING, {selector: guidedSetupAndTourStatusSelector});
    const {accountID: currentUserAccountID} = useCurrentUserPersonalDetails();
    const hasRequestedTransaction = useRef(false);
    const [hasSeenReportActionsLoading, setHasSeenReportActionsLoading] = useState(false);

    const isTransactionMissing = !!IOUTransactionID && isEmptyObject(transaction);
    const isLoadingReportActions = !!reportLoadingState?.isLoadingInitialReportActions;
    if (isLoadingReportActions && !hasSeenReportActionsLoading) {
        setHasSeenReportActionsLoading(true);
    }

    useEffect(() => {
        if (!isTransactionMissing || isLoadingReportActions || hasRequestedTransaction.current) {
            return;
        }
        hasRequestedTransaction.current = true;
        openReport({
            reportID,
            reportActionID: reportAction?.reportActionID,
            introSelected,
            conciergeChat,
            hasReportActions: true,
            currentUserAccountID,
            isSelfTourViewed: guidedSetupAndTourStatus?.isSelfTourViewed,
            hasCompletedGuidedSetupFlow: guidedSetupAndTourStatus?.hasCompletedGuidedSetupFlow,
            shouldMarkAsRead: false,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- the request only depends on whether the transaction is missing and the chat has settled
    }, [isTransactionMissing, isLoadingReportActions]);

    // A missing transaction only counts as gone once a chat load has finished after this page mounted.
    const isLoadingTransaction = isTransactionMissing && (isLoadingReportActions || !hasSeenReportActionsLoading);

    return {transaction, isLoadingTransaction};
}

export default useSplitContainerTransaction;
