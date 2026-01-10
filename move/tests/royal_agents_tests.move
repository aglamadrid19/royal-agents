module royal_agents::royal_agents_tests {
    use std::signer;
    use std::string;
    use std::vector;

    use aptos_framework::account;
    use aptos_framework::aptos_coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::coin;

    use royal_agents::agent_nft;
    use royal_agents::fee_manager;
    use royal_agents::marketplace;

    fun sample_hash(): vector<u8> {
        let bytes = vector::empty<u8>();
        let i = 0;
        while (i < 32) {
            vector::push_back(&mut bytes, 1);
            i = i + 1;
        };
        bytes
    }

    #[test]
    fun test_mint_and_update() {
        let admin = account::create_account_for_test(@royal_agents);
        agent_nft::init(&admin);

        let alice = account::create_account_for_test(@0xB);
        let metadata = string::utf8(b"ipfs://agent-metadata");
        let name = string::utf8(b"SciGrok");
        let description = string::utf8(b"Scientific researcher agent");
        let model = string::utf8(b"grok-4-1-fast-reasoning");
        let provider = agent_nft::provider_xai();
        let config_hash = sample_hash();
        let agent_type = agent_nft::agent_type_hosted();
        agent_nft::mint_agent(
            &alice,
            metadata,
            name,
            description,
            model,
            provider,
            agent_type,
            config_hash,
            100,
            0,
            0
        );
        let agent_id = agent_nft::agent_count() - 1;

        assert!(agent_nft::owner_of(agent_id) == signer::address_of(&alice), 100);
        assert!(agent_nft::key_status(agent_id) == agent_nft::key_missing(), 101);

        agent_nft::update_usage_fee(&alice, agent_id, 200);
        assert!(agent_nft::usage_fee(agent_id) == 200, 102);

        agent_nft::pause(&alice, agent_id, true);
        assert!(agent_nft::is_paused(agent_id), 103);
    }

    #[test]
    #[expected_failure(abort_code = 5, location = royal_agents::marketplace)]
    fun test_list_requires_key_set() {
        let admin = account::create_account_for_test(@royal_agents);
        agent_nft::init(&admin);
        marketplace::init(&admin);

        let alice = account::create_account_for_test(@0xB);
        let metadata = string::utf8(b"ipfs://agent-metadata");
        let name = string::utf8(b"SciGrok");
        let description = string::utf8(b"Scientific researcher agent");
        let model = string::utf8(b"grok-4-1-fast-reasoning");
        let provider = agent_nft::provider_xai();
        let config_hash = sample_hash();
        let agent_type = agent_nft::agent_type_hosted();
        agent_nft::mint_agent(
            &alice,
            metadata,
            name,
            description,
            model,
            provider,
            agent_type,
            config_hash,
            100,
            0,
            0
        );
        let agent_id = agent_nft::agent_count() - 1;
        marketplace::list(&alice, agent_id, 1_000);
    }

    #[test]
    fun test_buy_sets_key_missing() {
        let admin = account::create_account_for_test(@royal_agents);
        agent_nft::init(&admin);
        marketplace::init(&admin);

        let aptos_framework = account::create_account_for_test(@aptos_framework);
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(&aptos_framework);

        let alice = account::create_account_for_test(@0xB);
        let bob = account::create_account_for_test(@0xC);
        coin::register<AptosCoin>(&alice);
        coin::register<AptosCoin>(&bob);
        coin::deposit<AptosCoin>(signer::address_of(&bob), coin::mint(2_000, &mint_cap));

        let metadata = string::utf8(b"ipfs://agent-metadata");
        let name = string::utf8(b"SciGrok");
        let description = string::utf8(b"Scientific researcher agent");
        let model = string::utf8(b"grok-4-1-fast-reasoning");
        let provider = agent_nft::provider_xai();
        let config_hash = sample_hash();
        let agent_type = agent_nft::agent_type_hosted();
        agent_nft::mint_agent(
            &alice,
            metadata,
            name,
            description,
            model,
            provider,
            agent_type,
            config_hash,
            100,
            0,
            0
        );
        let agent_id = agent_nft::agent_count() - 1;
        agent_nft::set_key_status(&alice, agent_id, agent_nft::key_set());

        marketplace::list(&alice, agent_id, 1_000);
        marketplace::buy(&bob, agent_id);

        assert!(agent_nft::owner_of(agent_id) == signer::address_of(&bob), 200);
        assert!(agent_nft::key_status(agent_id) == agent_nft::key_missing(), 201);

        coin::destroy_mint_cap(mint_cap);
        coin::destroy_burn_cap(burn_cap);
    }

    #[test]
    #[expected_failure(abort_code = 2, location = royal_agents::fee_manager)]
    fun test_usage_duplicate_rejected() {
        let admin = account::create_account_for_test(@royal_agents);
        let platform = account::create_account_for_test(@0xA);
        let payer = account::create_account_for_test(@0xB);
        let owner = account::create_account_for_test(@0xC);
        let aptos_framework = account::create_account_for_test(@aptos_framework);
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(&aptos_framework);
        coin::register<AptosCoin>(&admin);
        coin::register<AptosCoin>(&platform);
        coin::register<AptosCoin>(&payer);
        coin::register<AptosCoin>(&owner);
        coin::deposit<AptosCoin>(signer::address_of(&admin), coin::mint(1_000_000, &mint_cap));

        fee_manager::init(&admin, signer::address_of(&platform), 500);
        fee_manager::settle_usage(
            &admin,
            1,
            signer::address_of(&payer),
            signer::address_of(&owner),
            1_000,
            500,
            4242
        );
        fee_manager::settle_usage(
            &admin,
            1,
            signer::address_of(&payer),
            signer::address_of(&owner),
            1_000,
            500,
            4242
        );

        coin::destroy_mint_cap(mint_cap);
        coin::destroy_burn_cap(burn_cap);
    }

    #[test]
    fun test_settle_usage_refunds_and_splits() {
        let admin = account::create_account_for_test(@royal_agents);
        let platform = account::create_account_for_test(@0xA);
        let payer = account::create_account_for_test(@0xB);
        let owner = account::create_account_for_test(@0xC);
        let aptos_framework = account::create_account_for_test(@aptos_framework);
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(&aptos_framework);
        coin::register<AptosCoin>(&admin);
        coin::register<AptosCoin>(&platform);
        coin::register<AptosCoin>(&payer);
        coin::register<AptosCoin>(&owner);
        coin::deposit<AptosCoin>(signer::address_of(&admin), coin::mint(10_000, &mint_cap));

        fee_manager::init(&admin, signer::address_of(&platform), 500);
        fee_manager::settle_usage(
            &admin,
            1,
            signer::address_of(&payer),
            signer::address_of(&owner),
            1_000,
            600,
            777
        );

        assert!(coin::balance<AptosCoin>(signer::address_of(&owner)) == 570, 300);
        assert!(coin::balance<AptosCoin>(signer::address_of(&platform)) == 30, 301);
        assert!(coin::balance<AptosCoin>(signer::address_of(&payer)) == 400, 302);

        coin::destroy_mint_cap(mint_cap);
        coin::destroy_burn_cap(burn_cap);
    }

    #[test]
    #[expected_failure(abort_code = 11, location = royal_agents::agent_nft)]
    fun test_runner_requires_tool_config() {
        let admin = account::create_account_for_test(@royal_agents);
        agent_nft::init(&admin);

        let alice = account::create_account_for_test(@0xB);
        let metadata = string::utf8(b"ipfs://agent-metadata");
        let name = string::utf8(b"LogoRunner");
        let description = string::utf8(b"Runner agent");
        let model = string::utf8(b"logo-runner-v1");
        let provider = agent_nft::provider_none();
        let config_hash = sample_hash();
        let agent_type = agent_nft::agent_type_runner();
        agent_nft::mint_agent(
            &alice,
            metadata,
            name,
            description,
            model,
            provider,
            agent_type,
            config_hash,
            100,
            0,
            1
        );
    }
}
