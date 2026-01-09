module royal_agents::agent_nft {
    friend royal_agents::marketplace;
    use std::option::Self;
    use std::signer;
    use std::string::{Self, String};
    use std::vector;

    use aptos_std::table::{Self, Table};
    use aptos_framework::account;
    use aptos_framework::event;
    use aptos_framework::object;

    use aptos_token_objects::collection;
    use aptos_token_objects::token;

    const E_NOT_INITIALIZED: u64 = 1;
    const E_NOT_OWNER: u64 = 2;
    const E_AGENT_NOT_FOUND: u64 = 3;
    const E_KEY_STATUS_INVALID: u64 = 4;
    const E_CAP_MISSING: u64 = 5;
    const E_NOT_AUTHORIZED: u64 = 6;
    const E_ALREADY_INITIALIZED: u64 = 7;
    const E_INVALID_PROVIDER: u64 = 8;
    const E_INVALID_CONFIG_HASH: u64 = 9;

    const KEY_MISSING: u8 = 0;
    const KEY_SET: u8 = 1;
    const PROVIDER_XAI: u8 = 1;
    const PROVIDER_OPENAI: u8 = 2;
    const PROVIDER_ANTHROPIC: u8 = 3;
    const CONFIG_HASH_LEN: u64 = 32;

    const COLLECTION_URI_BYTES: vector<u8> = b"https://royalagents.example/collection";

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct Agent has key {
        agent_id: u64,
        metadata_uri: String,
        name: String,
        description: String,
        model: String,
        provider: u8,
        config_hash: vector<u8>,
        usage_fee: u64,
        owner: address,
        paused: bool,
        key_status: u8,
    }

    struct AgentRegistry has key {
        next_id: u64,
        agents: Table<u64, address>,
    }

    struct AgentTransferCap has store {
        agent_id: u64,
        transfer_ref: object::TransferRef,
    }

    struct OwnerCaps has key {
        caps: Table<u64, AgentTransferCap>,
    }

    struct AgentEvents has key {
        minted: event::EventHandle<AgentMinted>,
        fee_updated: event::EventHandle<FeeUpdated>,
        paused: event::EventHandle<Paused>,
        key_status_changed: event::EventHandle<KeyStatusChanged>,
    }

    #[event]
    struct AgentMinted has drop, store {
        agent_id: u64,
        owner: address,
        token_address: address,
    }

    #[event]
    struct FeeUpdated has drop, store {
        agent_id: u64,
        new_fee: u64,
    }

    #[event]
    struct Paused has drop, store {
        agent_id: u64,
        paused: bool,
    }

    #[event]
    struct KeyStatusChanged has drop, store {
        agent_id: u64,
        key_status: u8,
    }

    struct AgentView has drop, store {
        agent_id: u64,
        metadata_uri: String,
        name: String,
        description: String,
        model: String,
        provider: u8,
        config_hash: vector<u8>,
        usage_fee: u64,
        owner: address,
        paused: bool,
        key_status: u8,
        token_address: address,
    }

    public entry fun init(admin: &signer) {
        assert!(signer::address_of(admin) == @royal_agents, E_NOT_AUTHORIZED);
        assert!(!exists<AgentRegistry>(@royal_agents), E_ALREADY_INITIALIZED);
        move_to(admin, AgentRegistry { next_id: 0, agents: table::new() });
        move_to(
            admin,
            AgentEvents {
                minted: account::new_event_handle<AgentMinted>(admin),
                fee_updated: account::new_event_handle<FeeUpdated>(admin),
                paused: account::new_event_handle<Paused>(admin),
                key_status_changed: account::new_event_handle<KeyStatusChanged>(admin),
            },
        );
    }

    public entry fun mint_agent(
        creator: &signer,
        metadata_uri: String,
        name: String,
        description: String,
        model: String,
        provider: u8,
        config_hash: vector<u8>,
        usage_fee: u64
    )
    acquires AgentRegistry, AgentEvents, OwnerCaps {
        assert!(exists<AgentRegistry>(@royal_agents), E_NOT_INITIALIZED);
        assert!(
            provider == PROVIDER_XAI || provider == PROVIDER_OPENAI || provider == PROVIDER_ANTHROPIC,
            E_INVALID_PROVIDER
        );
        assert!(vector::length(&config_hash) == CONFIG_HASH_LEN, E_INVALID_CONFIG_HASH);
        let registry = borrow_global_mut<AgentRegistry>(@royal_agents);
        let agent_id = registry.next_id;
        registry.next_id = agent_id + 1;

        let owner_addr = signer::address_of(creator);
        ensure_collection(creator, owner_addr);

        let token_description = *&description;
        let name_prefix = *&name;
        let name_suffix = string::utf8(b"");
        let token_uri = *&metadata_uri;
        let constructor_ref = token::create_numbered_token(
            creator,
            collection_name(),
            token_description,
            name_prefix,
            name_suffix,
            option::none(),
            token_uri,
        );

        let token_address = object::address_from_constructor_ref(&constructor_ref);
        let object_signer = object::generate_signer(&constructor_ref);
        move_to(
            &object_signer,
            Agent {
                agent_id,
                metadata_uri,
                name,
                description,
                model,
                provider,
                config_hash,
                usage_fee,
                owner: owner_addr,
                paused: false,
                key_status: KEY_MISSING,
            },
        );

        let transfer_ref = object::generate_transfer_ref(&constructor_ref);
        object::disable_ungated_transfer(&transfer_ref);

        table::add(&mut registry.agents, agent_id, token_address);
        add_cap(creator, agent_id, AgentTransferCap { agent_id, transfer_ref });

        let events = borrow_global_mut<AgentEvents>(@royal_agents);
        event::emit_event(
            &mut events.minted,
            AgentMinted { agent_id, owner: owner_addr, token_address },
        );
    }

    public entry fun update_usage_fee(owner: &signer, agent_id: u64, new_fee: u64)
    acquires AgentRegistry, AgentEvents, OwnerCaps, Agent {
        assert_owner_with_cap(owner, agent_id);
        let agent = borrow_global_mut<Agent>(agent_address(agent_id));
        agent.usage_fee = new_fee;

        let events = borrow_global_mut<AgentEvents>(@royal_agents);
        event::emit_event(&mut events.fee_updated, FeeUpdated { agent_id, new_fee });
    }

    public entry fun pause(owner: &signer, agent_id: u64, pause: bool)
    acquires AgentRegistry, AgentEvents, OwnerCaps, Agent {
        assert_owner_with_cap(owner, agent_id);
        let agent = borrow_global_mut<Agent>(agent_address(agent_id));
        agent.paused = pause;

        let events = borrow_global_mut<AgentEvents>(@royal_agents);
        event::emit_event(&mut events.paused, Paused { agent_id, paused: pause });
    }

    public entry fun set_key_status(owner: &signer, agent_id: u64, key_status: u8)
    acquires AgentRegistry, AgentEvents, OwnerCaps, Agent {
        assert_owner_with_cap(owner, agent_id);
        assert!(key_status == KEY_SET || key_status == KEY_MISSING, E_KEY_STATUS_INVALID);
        let agent = borrow_global_mut<Agent>(agent_address(agent_id));
        agent.key_status = key_status;

        let events = borrow_global_mut<AgentEvents>(@royal_agents);
        event::emit_event(
            &mut events.key_status_changed,
            KeyStatusChanged { agent_id, key_status },
        );
    }

    #[view]
    public fun get_agent(agent_id: u64): AgentView acquires AgentRegistry, Agent {
        let token_address = agent_address(agent_id);
        let agent = borrow_global<Agent>(token_address);
        AgentView {
            agent_id,
            metadata_uri: *&agent.metadata_uri,
            name: *&agent.name,
            description: *&agent.description,
            model: *&agent.model,
            provider: agent.provider,
            config_hash: *&agent.config_hash,
            usage_fee: agent.usage_fee,
            owner: agent.owner,
            paused: agent.paused,
            key_status: agent.key_status,
            token_address,
        }
    }

    #[view]
    public fun agent_count(): u64 acquires AgentRegistry {
        let registry = borrow_global<AgentRegistry>(@royal_agents);
        registry.next_id
    }

    #[view]
    public fun owner_of(agent_id: u64): address acquires AgentRegistry, Agent {
        let agent = borrow_global<Agent>(agent_address(agent_id));
        agent.owner
    }

    #[view]
    public fun usage_fee(agent_id: u64): u64 acquires AgentRegistry, Agent {
        let agent = borrow_global<Agent>(agent_address(agent_id));
        agent.usage_fee
    }

    #[view]
    public fun metadata_uri(agent_id: u64): String acquires AgentRegistry, Agent {
        let agent = borrow_global<Agent>(agent_address(agent_id));
        *&agent.metadata_uri
    }

    #[view]
    public fun name(agent_id: u64): String acquires AgentRegistry, Agent {
        let agent = borrow_global<Agent>(agent_address(agent_id));
        *&agent.name
    }

    #[view]
    public fun description(agent_id: u64): String acquires AgentRegistry, Agent {
        let agent = borrow_global<Agent>(agent_address(agent_id));
        *&agent.description
    }

    #[view]
    public fun model(agent_id: u64): String acquires AgentRegistry, Agent {
        let agent = borrow_global<Agent>(agent_address(agent_id));
        *&agent.model
    }

    #[view]
    public fun provider(agent_id: u64): u8 acquires AgentRegistry, Agent {
        let agent = borrow_global<Agent>(agent_address(agent_id));
        agent.provider
    }

    #[view]
    public fun config_hash(agent_id: u64): vector<u8> acquires AgentRegistry, Agent {
        let agent = borrow_global<Agent>(agent_address(agent_id));
        *&agent.config_hash
    }

    #[view]
    public fun provider_xai(): u8 {
        PROVIDER_XAI
    }

    #[view]
    public fun provider_openai(): u8 {
        PROVIDER_OPENAI
    }

    #[view]
    public fun provider_anthropic(): u8 {
        PROVIDER_ANTHROPIC
    }

    #[view]
    public fun key_status(agent_id: u64): u8 acquires AgentRegistry, Agent {
        let agent = borrow_global<Agent>(agent_address(agent_id));
        agent.key_status
    }

    #[view]
    public fun key_missing(): u8 {
        KEY_MISSING
    }

    #[view]
    public fun key_set(): u8 {
        KEY_SET
    }

    #[view]
    public fun is_paused(agent_id: u64): bool acquires AgentRegistry, Agent {
        let agent = borrow_global<Agent>(agent_address(agent_id));
        agent.paused
    }

    public fun withdraw_transfer_cap(owner: &signer, agent_id: u64): AgentTransferCap
    acquires OwnerCaps, AgentRegistry, Agent {
        assert_owner_with_cap(owner, agent_id);
        let caps = borrow_global_mut<OwnerCaps>(signer::address_of(owner));
        table::remove(&mut caps.caps, agent_id)
    }

    public fun return_transfer_cap(owner: &signer, cap: AgentTransferCap)
    acquires OwnerCaps {
        add_cap(owner, cap.agent_id, cap);
    }

    public(friend) fun transfer_with_cap(cap: AgentTransferCap, buyer: &signer)
    acquires OwnerCaps, AgentRegistry, Agent {
        let agent_id = cap.agent_id;
        let token_address = agent_address(agent_id);
        let linear_ref = object::generate_linear_transfer_ref(&cap.transfer_ref);
        object::transfer_with_ref(linear_ref, signer::address_of(buyer));

        let agent = borrow_global_mut<Agent>(token_address);
        agent.owner = signer::address_of(buyer);
        agent.key_status = KEY_MISSING;

        add_cap(buyer, agent_id, cap);
    }

    fun ensure_collection(creator: &signer, owner_addr: address) {
        let name = collection_name();
        let collection_addr = collection::create_collection_address(&owner_addr, &name);
        if (!object::object_exists<collection::Collection>(collection_addr)) {
            let description = string::utf8(b"RoyalAgents collection");
            let uri = string::utf8(COLLECTION_URI_BYTES);
            collection::create_unlimited_collection(
                creator,
                description,
                name,
                option::none(),
                uri,
            );
        };
    }

    fun collection_name(): String {
        string::utf8(b"RoyalAgents")
    }

    fun agent_address(agent_id: u64): address acquires AgentRegistry {
        let registry = borrow_global<AgentRegistry>(@royal_agents);
        assert!(table::contains(&registry.agents, agent_id), E_AGENT_NOT_FOUND);
        *table::borrow(&registry.agents, agent_id)
    }

    fun add_cap(owner: &signer, agent_id: u64, cap: AgentTransferCap) acquires OwnerCaps {
        let owner_addr = signer::address_of(owner);
        if (!exists<OwnerCaps>(owner_addr)) {
            move_to(owner, OwnerCaps { caps: table::new() });
        };
        let caps = borrow_global_mut<OwnerCaps>(owner_addr);
        table::add(&mut caps.caps, agent_id, cap);
    }

    fun assert_owner_with_cap(owner: &signer, agent_id: u64)
    acquires OwnerCaps, AgentRegistry, Agent {
        let owner_addr = signer::address_of(owner);
        let agent = borrow_global<Agent>(agent_address(agent_id));
        assert!(agent.owner == owner_addr, E_NOT_OWNER);
        assert!(has_cap(owner_addr, agent_id), E_CAP_MISSING);
    }

    fun has_cap(owner_addr: address, agent_id: u64): bool acquires OwnerCaps {
        if (!exists<OwnerCaps>(owner_addr)) {
            return false;
        };
        let caps = borrow_global<OwnerCaps>(owner_addr);
        table::contains(&caps.caps, agent_id)
    }
}
