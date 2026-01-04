module royal_agents::royal_agents_tests {
    use std::signer;
    use std::string;

    use aptos_framework::account;
    use aptos_framework::aptos_coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::coin;

    use royal_agents::agent_nft;
    use royal_agents::fee_manager;
    use royal_agents::marketplace;

    #[test]
    fun test_mint_and_update() {
        let admin = account::create_account_for_test(@royal_agents);
        agent_nft::init(&admin);

        let alice = account::create_account_for_test(@0xB);
        let metadata = string::utf8(b"ipfs://agent-metadata");
        let agent_id = agent_nft::mint_agent(&alice, metadata, 100);

        let agent = agent_nft::get_agent(agent_id);
        assert!(agent.owner == signer::address_of(&alice), 100);
        assert!(agent.key_status == agent_nft::KEY_MISSING, 101);

        agent_nft::update_usage_fee(&alice, agent_id, 200);
        let updated = agent_nft::get_agent(agent_id);
        assert!(updated.usage_fee == 200, 102);

        agent_nft::pause(&alice, agent_id, true);
        let paused = agent_nft::get_agent(agent_id);
        assert!(paused.paused, 103);
    }

    #[test]
    #[expected_failure(abort_code = 5, location = royal_agents::marketplace)]
    fun test_list_requires_key_set() {
        let admin = account::create_account_for_test(@royal_agents);
        agent_nft::init(&admin);
        marketplace::init(&admin);

        let alice = account::create_account_for_test(@0xB);
        let metadata = string::utf8(b"ipfs://agent-metadata");
        let agent_id = agent_nft::mint_agent(&alice, metadata, 100);
        marketplace::list(&alice, agent_id, 1_000);
    }

    #[test]
    fun test_buy_sets_key_missing() {
        let admin = account::create_account_for_test(@royal_agents);
        agent_nft::init(&admin);
        marketplace::init(&admin);

        let aptos_framework = account::create_account_for_test(@aptos_framework);
        let (_, mint_cap) = aptos_coin::initialize_for_test(&aptos_framework);

        let alice = account::create_account_for_test(@0xB);
        let bob = account::create_account_for_test(@0xC);
        coin::register<AptosCoin>(&alice);
        coin::register<AptosCoin>(&bob);
        coin::deposit<AptosCoin>(signer::address_of(&bob), coin::mint(2_000, &mint_cap));

        let metadata = string::utf8(b"ipfs://agent-metadata");
        let agent_id = agent_nft::mint_agent(&alice, metadata, 100);
        agent_nft::set_key_status(&alice, agent_id, agent_nft::KEY_SET);

        marketplace::list(&alice, agent_id, 1_000);
        marketplace::buy(&bob, agent_id);

        let agent = agent_nft::get_agent(agent_id);
        assert!(agent.owner == signer::address_of(&bob), 200);
        assert!(agent.key_status == agent_nft::KEY_MISSING, 201);
    }

    #[test]
    #[expected_failure(abort_code = 2, location = royal_agents::fee_manager)]
    fun test_usage_duplicate_rejected() {
        let admin = account::create_account_for_test(@royal_agents);
        fee_manager::init(&admin);
        fee_manager::record_usage(&admin, 1, @0xB, 100, 4242);
        fee_manager::record_usage(&admin, 1, @0xB, 100, 4242);
    }
}
