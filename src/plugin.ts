import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { IPDisplay } from "./actions/local-ip-display";
import { LocalIPOnlyDisplay } from "./actions/local-ip-only-display";
import { PublicIPOnlyDisplay } from "./actions/public-ip-only-display";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register the IP Display actions.
streamDeck.actions.registerAction(new IPDisplay());
streamDeck.actions.registerAction(new LocalIPOnlyDisplay());
streamDeck.actions.registerAction(new PublicIPOnlyDisplay());

// Finally, connect to the Stream Deck.
streamDeck.connect();
