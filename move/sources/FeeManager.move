module royal_agents::fee_manager {
    use std::signer;
    use aptos_std::table::{Self, Table};
    use aptos_framework::event;

    const E_NOT_INITIALIZED: u64 = 1;
    const E_DUPLICATE_REQUEST: u64 = 2;
    const E_NOT_AUTHORIZED: u64 = 3;
    const E_ALREADY_INITIALIZED: u64 = 4;

    const PROTOCOL_FEE_BPS: u64 = 500;

    struct UsageStore has key {
        usage: Table<u128, bool>,
    }

    struct UsageEvents has key {
        usage_recorded: event::EventHandle<UsageRecorded>,
    }

    struct UsageCap has key {}

    #[event]
    struct UsageRecorded has drop, store {
        agent_id: u64,
        payer: address,
        amount: u64,
        request_hash: u128,
    }

    public entry fun init(admin: &signer) {
        assert!(signer::address_of(admin) == @royal_agents, E_NOT_AUTHORIZED);
        assert!(!exists<UsageStore>(@royal_agents), E_ALREADY_INITIALIZED);
        move_to(admin, UsageStore { usage: table::new() });
        move_to(
            admin,
            UsageEvents { usage_recorded: event::new_event_handle<UsageRecorded>(admin) },
        );
        move_to(admin, UsageCap {});
    }

    #[view]
    public fun protocol_fee_bps(): u64 {
        PROTOCOL_FEE_BPS
    }

    public entry fun record_usage(
        authorized: &signer,
        agent_id: u64,
        payer: address,
        amount: u64,
        request_hash: u128,
    ) acquires UsageStore, UsageEvents, UsageCap {
        assert!(exists<UsageStore>(@royal_agents), E_NOT_INITIALIZED);
        assert!(exists<UsageCap>(signer::address_of(authorized)), E_NOT_AUTHORIZED);
        let store = borrow_global_mut<UsageStore>(@royal_agents);
        assert!(!table::contains(&store.usage, request_hash), E_DUPLICATE_REQUEST);
        table::add(&mut store.usage, request_hash, true);

        let events = borrow_global_mut<UsageEvents>(@royal_agents);
        event::emit_event(
            &mut events.usage_recorded,
            UsageRecorded { agent_id, payer, amount, request_hash },
        );
    }

    #[view]
    public fun has_record(request_hash: u128): bool acquires UsageStore {
        assert!(exists<UsageStore>(@royal_agents), E_NOT_INITIALIZED);
        let store = borrow_global<UsageStore>(@royal_agents);
        table::contains(&store.usage, request_hash)
    }
}
