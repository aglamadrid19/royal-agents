module royal_agents::marketplace {
    use std::signer;

    use aptos_std::table::{Self, Table};
    use aptos_framework::account;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::coin;
    use aptos_framework::event;

    use royal_agents::agent_nft;

    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_LISTED: u64 = 2;
    const E_NOT_LISTED: u64 = 3;
    const E_NOT_SELLER: u64 = 4;
    const E_KEY_MISSING: u64 = 5;
    const E_NOT_OWNER: u64 = 6;
    const E_ALREADY_INITIALIZED: u64 = 7;
    const E_NOT_AUTHORIZED: u64 = 8;

    struct ListingStore has key {
        listings: Table<u64, Listing>,
    }

    struct Listing has store {
        agent_id: u64,
        seller: address,
        price: u64,
        cap: agent_nft::AgentTransferCap,
    }

    struct ListingEvents has key {
        listed: event::EventHandle<Listed>,
        delisted: event::EventHandle<Delisted>,
        sold: event::EventHandle<Sold>,
    }

    #[event]
    struct Listed has drop, store {
        agent_id: u64,
        seller: address,
        price: u64,
    }

    #[event]
    struct Delisted has drop, store {
        agent_id: u64,
        seller: address,
    }

    #[event]
    struct Sold has drop, store {
        agent_id: u64,
        seller: address,
        buyer: address,
        price: u64,
    }

    struct ListingView has drop, store {
        agent_id: u64,
        seller: address,
        price: u64,
    }

    public entry fun init(admin: &signer) {
        assert!(signer::address_of(admin) == @royal_agents, E_NOT_AUTHORIZED);
        assert!(!exists<ListingStore>(@royal_agents), E_ALREADY_INITIALIZED);
        move_to(admin, ListingStore { listings: table::new() });
        move_to(
            admin,
            ListingEvents {
                listed: account::new_event_handle<Listed>(admin),
                delisted: account::new_event_handle<Delisted>(admin),
                sold: account::new_event_handle<Sold>(admin),
            },
        );
    }

    public entry fun list(owner: &signer, agent_id: u64, price: u64)
    acquires ListingStore, ListingEvents {
        assert!(exists<ListingStore>(@royal_agents), E_NOT_INITIALIZED);
        assert!(agent_nft::key_status(agent_id) == agent_nft::key_set(), E_KEY_MISSING);

        let store = borrow_global_mut<ListingStore>(@royal_agents);
        assert!(!table::contains(&store.listings, agent_id), E_ALREADY_LISTED);

        let cap = agent_nft::withdraw_transfer_cap(owner, agent_id);
        let seller = signer::address_of(owner);
        table::add(
            &mut store.listings,
            agent_id,
            Listing { agent_id, seller, price, cap },
        );

        let events = borrow_global_mut<ListingEvents>(@royal_agents);
        event::emit_event(&mut events.listed, Listed { agent_id, seller, price });
    }

    public entry fun cancel(owner: &signer, agent_id: u64)
    acquires ListingStore, ListingEvents {
        assert!(exists<ListingStore>(@royal_agents), E_NOT_INITIALIZED);
        let store = borrow_global_mut<ListingStore>(@royal_agents);
        assert!(table::contains(&store.listings, agent_id), E_NOT_LISTED);

        let listing = table::remove(&mut store.listings, agent_id);
        let Listing { agent_id, seller: listing_seller, price: _, cap } = listing;
        let seller = signer::address_of(owner);
        assert!(listing_seller == seller, E_NOT_SELLER);

        agent_nft::return_transfer_cap(owner, cap);

        let events = borrow_global_mut<ListingEvents>(@royal_agents);
        event::emit_event(&mut events.delisted, Delisted { agent_id, seller });
    }

    public entry fun buy(buyer: &signer, agent_id: u64)
    acquires ListingStore, ListingEvents {
        assert!(exists<ListingStore>(@royal_agents), E_NOT_INITIALIZED);
        assert!(agent_nft::key_status(agent_id) == agent_nft::key_set(), E_KEY_MISSING);

        let store = borrow_global_mut<ListingStore>(@royal_agents);
        assert!(table::contains(&store.listings, agent_id), E_NOT_LISTED);

        let listing = table::remove(&mut store.listings, agent_id);
        let Listing { agent_id, seller, price, cap } = listing;
        let current_owner = agent_nft::owner_of(agent_id);
        assert!(seller == current_owner, E_NOT_OWNER);

        coin::transfer<AptosCoin>(buyer, seller, price);
        agent_nft::transfer_with_cap(cap, buyer);

        let events = borrow_global_mut<ListingEvents>(@royal_agents);
        event::emit_event(
            &mut events.sold,
            Sold {
                agent_id,
                seller,
                buyer: signer::address_of(buyer),
                price,
            },
        );
    }

    #[view]
    public fun get_listing(agent_id: u64): ListingView acquires ListingStore {
        let store = borrow_global<ListingStore>(@royal_agents);
        assert!(table::contains(&store.listings, agent_id), E_NOT_LISTED);
        let listing = table::borrow(&store.listings, agent_id);
        ListingView { agent_id, seller: listing.seller, price: listing.price }
    }
}
