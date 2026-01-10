module royal_agents::fee_manager {
    use std::signer;
    use aptos_std::table::{Self, Table};
    use aptos_framework::account;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::coin;
    use aptos_framework::event;

    const E_NOT_INITIALIZED: u64 = 1;
    const E_DUPLICATE_REQUEST: u64 = 2;
    const E_NOT_AUTHORIZED: u64 = 3;
    const E_ALREADY_INITIALIZED: u64 = 4;
    const E_INVALID_AMOUNT: u64 = 5;
    const E_INVALID_FEE_BPS: u64 = 6;

    struct UsageStore has key {
        usage: Table<u128, bool>,
    }

    struct TreasuryConfig has key {
        platform_wallet: address,
        fee_bps: u64,
    }

    struct UsageEvents has key {
        usage_settled: event::EventHandle<UsageSettled>,
    }

    struct TreasuryCap has key {}

    #[event]
    struct UsageSettled has drop, store {
        agent_id: u64,
        payer: address,
        owner: address,
        max_amount: u64,
        actual_amount: u64,
        owner_amount: u64,
        platform_amount: u64,
        refund_amount: u64,
        request_hash: u128,
    }

    public entry fun init(admin: &signer, platform_wallet: address, fee_bps: u64) {
        assert!(signer::address_of(admin) == @royal_agents, E_NOT_AUTHORIZED);
        assert!(!exists<UsageStore>(@royal_agents), E_ALREADY_INITIALIZED);
        assert!(fee_bps <= 10_000, E_INVALID_FEE_BPS);
        move_to(admin, UsageStore { usage: table::new() });
        move_to(
            admin,
            UsageEvents { usage_settled: account::new_event_handle<UsageSettled>(admin) },
        );
        move_to(admin, TreasuryConfig { platform_wallet, fee_bps });
        move_to(admin, TreasuryCap {});
    }

    #[view]
    public fun protocol_fee_bps(): u64 acquires TreasuryConfig {
        let config = borrow_global<TreasuryConfig>(@royal_agents);
        config.fee_bps
    }

    #[view]
    public fun platform_wallet(): address acquires TreasuryConfig {
        let config = borrow_global<TreasuryConfig>(@royal_agents);
        config.platform_wallet
    }

    public entry fun settle_usage(
        admin: &signer,
        agent_id: u64,
        payer: address,
        owner: address,
        max_amount: u64,
        actual_amount: u64,
        request_hash: u128,
    ) acquires UsageStore, UsageEvents, TreasuryConfig {
        assert!(exists<UsageStore>(@royal_agents), E_NOT_INITIALIZED);
        assert!(exists<TreasuryCap>(signer::address_of(admin)), E_NOT_AUTHORIZED);
        assert!(actual_amount <= max_amount, E_INVALID_AMOUNT);
        let store = borrow_global_mut<UsageStore>(@royal_agents);
        assert!(!table::contains(&store.usage, request_hash), E_DUPLICATE_REQUEST);
        table::add(&mut store.usage, request_hash, true);

        let config = borrow_global<TreasuryConfig>(@royal_agents);
        let fee_bps = config.fee_bps;
        let protocol_fee =
            ((actual_amount as u128) * (fee_bps as u128) / 10_000) as u64;
        let owner_amount = actual_amount - protocol_fee;
        let refund_amount = max_amount - actual_amount;

        if (owner_amount > 0) {
            coin::transfer<AptosCoin>(admin, owner, owner_amount);
        };
        if (protocol_fee > 0) {
            coin::transfer<AptosCoin>(admin, config.platform_wallet, protocol_fee);
        };
        if (refund_amount > 0) {
            coin::transfer<AptosCoin>(admin, payer, refund_amount);
        };

        let events = borrow_global_mut<UsageEvents>(@royal_agents);
        event::emit_event(
            &mut events.usage_settled,
            UsageSettled {
                agent_id,
                payer,
                owner,
                max_amount,
                actual_amount,
                owner_amount,
                platform_amount: protocol_fee,
                refund_amount,
                request_hash,
            },
        );
    }

    #[view]
    public fun has_record(request_hash: u128): bool acquires UsageStore {
        assert!(exists<UsageStore>(@royal_agents), E_NOT_INITIALIZED);
        let store = borrow_global<UsageStore>(@royal_agents);
        table::contains(&store.usage, request_hash)
    }
}
