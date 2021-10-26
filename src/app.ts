/**
 * The core /Controller/ of the "Floating Librarian" Slack-Bolt application
 * TODOs: see GitHub
 */
const { App } = require('@slack/bolt');
const blockHelper = require('./block-helper');
const openlibrary = require('./openlibrary-api');
const database = require('./postgres-repo');
var Sentry = require("@sentry/node");
var Tracing = require("@sentry/tracing");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

database.setup()

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
  ],
  tracesSampleRate: 1.0,
});


// Tracing/timing middleware to have proper transactions and spans in sentry
async function timeWithSentry({ payload, client, context, next }: any) {
  const transaction = Sentry.startTransaction({
    op: "Incoming request",
    name: payload.action_id ?? payload.type,
  });
  Sentry.configureScope((scope: any) => {
    scope.setSpan(transaction);
  });

  try {
    await next();
  } catch (err: any) {
    Sentry.captureException(err)
  }
  transaction?.finish()
}

app.use(timeWithSentry)


/**
 * Creates the default home view
 * @param teamId Slack teamId of the calling user
 * @param memberId Slack memberId of the calling user
 * @returns Block Kit blocks for the default Home View
 */
async function createHomeView(teamId: string, memberId: string) {
  let collectionItems: CollectionItem[] = await database.getBookCollection(teamId, memberId)

  const headerBlocks = blockHelper.createHomeViewHeaderBlocks(memberId, collectionItems.length >= 30)
  const collectionItemBlocks = collectionItems.map((collectionItem: CollectionItem) => blockHelper.createCollectionBookSpecificBlocks(collectionItem, true)).flat()
  return [...headerBlocks, ...collectionItemBlocks]
}

/**
 * Invoked when a user opens the app home
 */
app.event('app_home_opened', async ({event, client, body}: any) => {
  try {
    await client.views.publish({
      user_id: event.user,
      view: {
        "type": "home",
        "blocks": await createHomeView(body.team_id, event.user)
      }
    });
  }
  catch (error) {
    console.error(error);
  }
});

/**
 * Invoked when a user searches for books
 */
app.action('book_search_submit', async ({ body, ack, client, payload }: any) => {
  await ack();
  let blocks = blockHelper.createHomeViewHeaderBlocks(body.user.id)
  blocks.push(blockHelper.createBookSearchQueryInfoBlock(payload.value))


  const [bookSearchResults, collectionItems] = await Promise.all([
    openlibrary.searchBooks(payload.value),
    database.getBookCollection(body.user.team_id, body.user.id)
  ])
  const userCollectionIsbns: string[] = collectionItems.map((collectionItem: CollectionItem) => collectionItem.isbn)

  const bookSearchIsbns = bookSearchResults.map((book: Book) => book.isbn)
  const collectionInfoForSearchResults = await database.getCollectionInfoForBooks(body.user.team_id, bookSearchIsbns)

  const bookSearchResultBlocks = bookSearchResults?.map(
    (book: Book): any => {
      const collectionInfoItem: CollectionInfo = collectionInfoForSearchResults.find((infoItem: CollectionInfo) => infoItem.isbn === book.isbn) || {
        isbn: book.isbn,
        ownerCount: 0,
        lenderCount: 0,
        avgRating: 0
      }
      return blockHelper.createBookSearchResultBlocks(book, userCollectionIsbns.includes(book.isbn), collectionInfoItem)
    }
  ).flat() || []

  blocks.push(...bookSearchResultBlocks)

  await client.views.update({
    view_id: body.view.id,
    hash: body.view.hash,
    view: {
      "type": "home",
      "blocks": blocks
    }
  });
});

/**
 * Invoked when a user clicks the "Add to collection" button on a search result item
 */
app.action('collection_add_item', async ({ body, ack, client, payload }: any) => {
  await ack();
  let [isbn, title, authorName, coverId] = payload.value.split("|", 4)
  await database.addBook(body.user.team_id, body.user.id, isbn, title, authorName, coverId)
  await client.views.update({
    view_id: body.view.id,
    hash: body.view.hash,
    view: {
      "type": "home",
      "blocks": await createHomeView(body.user.team_id, body.user.id)
    }
  });
});

/**
 * Invoked when a user clicks the "Remove from collection" button on one of their collection item in their home view
 */
app.action('collection_remove_item', async ({ body, ack, client, payload }: any) => {
  await ack();
  await database.removeBook(body.user.team_id, body.user.id, payload.value)
  await client.views.update({
    view_id: body.view.id,
    hash: body.view.hash,
    view: {
      "type": "home",
      "blocks": await createHomeView(body.user.team_id, body.user.id)
    }
  });
});

/**
 * Invoked when a user changes the rating of one of their collection items in their home view
 */
app.action('collection_item_update_rating', async ({ body, ack, client, payload }: any) => {
  await ack();
  let [isbn, rating] = payload.selected_option.value.split("|", 2)
  await database.updateRating(body.user.team_id, body.user.id, isbn, parseInt(rating))
  await client.views.update({
    view_id: body.view.id,
    hash: body.view.hash,
    view: {
      "type": "home",
      "blocks": await createHomeView(body.user.team_id, body.user.id)
    }
  });
});

/**
 * Invoked when a user changes the lend-out state of one of their collection items in their home view
 */
app.action('collection_item_update_lend_out', async ({ body, ack, client, payload }: any) => {
  await ack();
  let [isbn, lendOut] = payload.selected_option.value.split("|", 2)
  await database.updateLendOut(body.user.team_id, body.user.id, isbn, lendOut === "true")
  await client.views.update({
    view_id: body.view.id,
    hash: body.view.hash,
    view: {
      "type": "home",
      "blocks": await createHomeView(body.user.team_id, body.user.id)
    }
  });
});

/**
 * Invoked when a user clicks on the "close" button on the search result page (could potentially be redirected to the normal app's home)
 */
app.action("show_home", async ({ body, ack, client, payload }: any) => {
  await ack();
  await client.views.update({
    view_id: body.view.id,
    hash: body.view.hash,
    view: {
      "type": "home",
      "blocks": await createHomeView(body.user.team_id, body.user.id)
    }
  });
});

/**
 * Invoked when a user clicks on the "Borrow" button on a search result
 */
app.action("collection_item_find_lenders", async ({ body, ack, client, payload }: any) => {
  await ack();
  const [isbn, bookTitle] = payload.value.split("|")
  const lenderList: string[] = await database.getPotentialLenders(body.user.team_id, body.user.id, isbn)
  const blocks = blockHelper.createLenderListBlocks(lenderList, bookTitle)

  await client.views.open({
    trigger_id: body.trigger_id,
    view: {
      "type": "modal",
      "close": {
        "type": "plain_text",
        "text": "Back",
        "emoji": true
      },
      "title": {
        "type": "plain_text",
        "text": "Potential lenders",
        "emoji": true
      },
      "blocks": blocks
    }
  });
});

/**
 * Invoked when a user clicks on the "Find owners" button on a search result or "Find other owners" button on an item in their home view
 */
app.action("collection_item_find_other_ratings", async ({ body, ack, client, payload }: any) => {
  await ack();
  const [isbn, bookTitle, userOwnsIt] = payload.value.split("|", 3)
  const userRatings = await database.getUserRatings(body.user.team_id, body.user.id, isbn)
  const blocks = blockHelper.createUserRatingsBlocks(userRatings, bookTitle, userOwnsIt === "true")

  await client.views.open({
    trigger_id: body.trigger_id,
    view: {
      "type": "modal",
      "close": {
        "type": "plain_text",
        "text": "Back",
        "emoji": true
      },
      "title": {
        "type": "plain_text",
        "text": "Other owners in the team",
        "emoji": true
      },
      "blocks": blocks
    }
  });
});

/**
 * Invoked when a user enters a user in the search box for other user's collections
 */
app.action("other_users_collection", async ({ body, ack, client, payload }: any) => {
  await ack();
  const collectionItems = await database.getBookCollection(body.user.team_id, payload.selected_user)
  let collectionItemBlocks = []
  if(collectionItems.length > 0){
    collectionItemBlocks = [
      {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": `Have a look at <@${payload.selected_user}>'s collection`
        }
      },
      ...collectionItems.map((collectionItem: CollectionItem) => blockHelper.createCollectionBookSpecificBlocks(collectionItem, false)).flat()
    ]
  }else{
    collectionItemBlocks = [
      {
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": `Looks like <@${payload.selected_user}> doesn't have any books in their collection yet 😟`
        }
    },
    ]
  }
      
  await client.views.open({
    trigger_id: body.trigger_id,
    view: {
      "type": "modal",
      "close": {
        "type": "plain_text",
        "text": "Back",
        "emoji": true
      },
      "title": {
        "type": "plain_text",
        "text": "Your teammate's books",
        "emoji": true
      },
      "blocks": collectionItemBlocks
    }
  });
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  console.log('⚡️ The floating librarian is floating again!');
})();