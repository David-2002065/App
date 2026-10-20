import {transferWalletBalance} from '@libs/actions/PaymentMethods';
import {WRITE_COMMANDS} from '@libs/API/types';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type PaymentMethod from '@src/types/onyx/PaymentMethod';

import Onyx from 'react-native-onyx';

import type {MockFetch} from '../utils/TestHelper';

import getOnyxValue from '../utils/getOnyxValue';
import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';

const BALANCE = 12400;

const bankAccount: PaymentMethod = {
    accountType: CONST.PAYMENT_METHODS.PERSONAL_BANK_ACCOUNT,
    methodID: 1234,
    title: 'Plaid Checking',
    description: 'Ending in 0000',
    icon: () => null,
};

describe('actions/PaymentMethods transferWalletBalance', () => {
    let mockFetch: MockFetch;

    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        mockFetch = TestHelper.createGlobalFetchMock();
        global.fetch = mockFetch;
        await Onyx.clear();
        await Onyx.set(ONYXKEYS.USER_WALLET, {tierName: CONST.WALLET.TIER_NAME.GOLD, currentBalance: BALANCE});
        await waitForBatchedUpdates();
    });

    afterEach(() => {
        mockFetch?.resume?.();
    });

    it('zeroes the wallet balance after a successful transfer so it cannot be transferred again', async () => {
        // Given a Gold wallet with a positive balance and a server response that carries no wallet update
        // When the user transfers the balance
        transferWalletBalance(bankAccount, BALANCE);
        await waitForBatchedUpdates();

        // Then the balance gating the Transfer button is 0, as PR #7681 did before the API.write refactor dropped it
        const userWallet = await getOnyxValue(ONYXKEYS.USER_WALLET);
        expect(userWallet?.currentBalance).toBe(0);
    });

    it('keeps the balance at 0 when the response echoes the pre-transfer wallet', async () => {
        // Given the server returns the wallet with the not yet settled balance in its onyxData
        mockFetch?.mockAPICommand?.(WRITE_COMMANDS.TRANSFER_WALLET_BALANCE, () => ({
            onyxData: [{onyxMethod: Onyx.METHOD.MERGE, key: ONYXKEYS.USER_WALLET, value: {currentBalance: BALANCE}}],
        }));

        // When the user transfers the balance
        transferWalletBalance(bankAccount, BALANCE);
        await waitForBatchedUpdates();

        // Then successData, applied after the response onyxData, still leaves the balance at 0
        const userWallet = await getOnyxValue(ONYXKEYS.USER_WALLET);
        expect(userWallet?.currentBalance).toBe(0);
    });

    it('restores the balance when the transfer fails', async () => {
        // Given the transfer request fails on the server
        mockFetch?.fail?.();

        // When the user transfers the balance
        transferWalletBalance(bankAccount, BALANCE);
        await waitForBatchedUpdates();

        // Then the original balance is back so the user can retry
        const userWallet = await getOnyxValue(ONYXKEYS.USER_WALLET);
        expect(userWallet?.currentBalance).toBe(BALANCE);
    });
});
