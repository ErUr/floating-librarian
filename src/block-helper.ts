/**
 * Helper functions to create Block Kit objects
 */
module.exports = {
    /**
     * Creates header blocks for the home view
     * 
     * @param memberId: string - Slack memberId of the calling user
     * @param collectionFull: boolean - indicates whether the user has reached the book limit of 30 to disable search
     * @returns An array of Block Kit blocks
     */
    createHomeViewHeaderBlocks: function (memberId: string, collectionFull: boolean): any[] {
        return [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `*Welcome to your own private collection in the floating library <@${memberId}>*`
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "This is where you enter all your favorite books to chat about them with your colleagues. \n You can also lend them out if you want!"
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "input",
                "dispatch_action": true,
                "element": {
                    "type": "users_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select user",
                        "emoji": true
                    },
                    "action_id": "other_users_collection"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Check out another user's collection:",
                    "emoji": true
                }
            },
            {
                "type": "divider"
            },
            collectionFull ? {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Sorry! No search* \n Your collection has reached the size limit of 30 books! If you want to add books you'll have to remove some others first. \n A premium version with a higher book limit will be released soon!"
                }
            } : {
                "dispatch_action": true,
                "type": "input",
                "element": {
                    "type": "plain_text_input",
                    "action_id": "book_search_submit"
                },
                "label": {
                    "type": "plain_text",
                    "text": "Search books to borrow or add to your collection: 📖🔎",
                    "emoji": true
                }
            }
        ]
    },

    /**
     * Creates a book search query result block containing info about the search term
     * @param searchString: string - the text the user searched for
     * @returns A single Block Kit block 
     */
    createBookSearchQueryInfoBlock: function (searchString: string): any {
        return {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": `You searched for: *${searchString}*`
            },
            "accessory": {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "close",
                    "emoji": true
                },
                "action_id": "show_home"
            }
        }
    },

    /**
     * Creates a book search query result block containing info about a single book search result
     * @param book: Book - the book that was found
     * @param inCollection: boolean - whether the user has the book already in their collection
     * @param collectionInfo: CollectionInfo - meta data about the book in the team's context
     * @returns An array of Block Kit blocks
     */
    createBookSearchResultBlocks: function (book: Book, inCollection: boolean, collectionInfo: CollectionInfo): any[] {
        let buttonElements: any = [
            {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Add to collection",
                    "emoji": true
                },
                "style": "primary",
                "value": book.isbn + "|" + book.title + "|" + book.authorName + "|" + book.coverId,
                "action_id": "collection_add_item"
            }
        ]
        if (collectionInfo.lenderCount > 0) {
            buttonElements.push(
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Borrow",
                        "emoji": true
                    },
                    "value": book.isbn + "|" + book.title,
                    "action_id": "collection_item_find_lenders"
                }
            )
        }
        if (collectionInfo.ownerCount > 0) {
            buttonElements.push(
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Find owners",
                        "emoji": true
                    },
                    "value": book.isbn + "|" + book.title + "|" + "false", //user doesn't own it
                    "action_id": "collection_item_find_other_ratings"
                }
            )
        }
        let results = [
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `*${book.title}* \n Author: ${book.authorName} \n ISBN: ${book.isbn}` +
                        (collectionInfo.ownerCount > 0 ? "\n Owners in your team: " + collectionInfo.ownerCount : "") +
                        (collectionInfo.avgRating !== 0 ? " \n Average rating in your team: " + "⭐".repeat(Math.round(collectionInfo.avgRating)) : "") +
                        (collectionInfo.lenderCount > 0 ? "\n Potential lenders in your team: " + collectionInfo.lenderCount : "")
                },
                "accessory": {
                    "type": "image",
                    "image_url": `http://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`,
                    "alt_text": "book cover"
                }
            },
            inCollection ? {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "✅ Already in your collection"
                }
            } : {
                "type": "actions",
                "elements": buttonElements
            }
        ]
        return results
    },

    /**
     * Creates Block Kit blocks representing a list of potential lenders
     * @param lenderList: string[] - Slack memberIds of potential lenders
     * @param bookTitle: string - Title of the book for display
     * @returns An array of Block Kit blocks
     */
    createLenderListBlocks: function (lenderList: string[], bookTitle: string): any[] {
        if (lenderList.length === 0) {
            return [{
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": `Unfortunately it seems there's nobody who could lend you ${bookTitle} right now 😞`
                }
            }]
        } else {
            return [{
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": `:tada: We found ${lenderList.length} ${lenderList.length == 1 ? "person" : "people"} who could lend you ${bookTitle}`
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": lenderList.map((memberId: string): string => `<@${memberId}>`).join(", ")
                }
            }]
        }
    },

    /**
     * Creates Block Kit blocks representing a list of the calling User's team members who own a specific book
     * @param userRatings: UserRating[] - Ratings of the book from other users
     * @param bookTitle: string - Title of the book for display 
     * @param userOwnsIt: boolean - Indicates whether the user already owns the book - currently used for a minor wording change only
     * @returns An array of Block Kit blocks
     */
    createUserRatingsBlocks: function (userRatings: UserRating[], bookTitle: string, userOwnsIt: boolean): any[] {
        if (userRatings.length === 0) {
            return [{
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": `Looks like nobody else in your team owns ${bookTitle} 😞`
                }
            }]
        } else {
            const ratingFields = userRatings.map((userRating: UserRating) => {
                return [{
                    "type": "mrkdwn",
                    "text": `<@${userRating.memberId}>`
                },
                {
                    "type": "mrkdwn",
                    "text": userRating.rating === 0 ? "No rating" : "⭐".repeat(userRating.rating)
                }
                ]
            }).flat()

            let results = [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": `:tada: We found ${userRatings.length}${userOwnsIt ? " other " : " "}${userRatings.length == 1 ? "person who owns" : "people who own"} ${bookTitle}`
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": "*User*"
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*Rating*"
                        }, ...ratingFields
                    ]
                }]
            return results
        }
    },

    /**
     * Creates Block Kit blocks representing books in a users collection
     * @param collectionItem: CollectionItem - the collection data of a single book for the requested user
     * @param showInteractionOptions: boolean - indicates whether action blocks in the context of the specific item should be included
     * @returns An array of Block Kit blocks
     */
    createCollectionBookSpecificBlocks: function (collectionItem: CollectionItem, showInteractionOptions: boolean): any[] {
        const actionElements: any[] = []
        if (showInteractionOptions) {
            actionElements.push(...[
                {
                    "type": "static_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": collectionItem.rating === 0 ? "No rating" : "⭐".repeat(collectionItem.rating),
                        "emoji": true
                    },
                    "options": [
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "No rating",
                                "emoji": true
                            },
                            "value": collectionItem.isbn + "|" + "0"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "⭐",
                                "emoji": true
                            },
                            "value": collectionItem.isbn + "|" + "1"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "⭐⭐",
                                "emoji": true
                            },
                            "value": collectionItem.isbn + "|" + "2"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "⭐⭐⭐",
                                "emoji": true
                            },
                            "value": collectionItem.isbn + "|" + "3"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "⭐⭐⭐⭐",
                                "emoji": true
                            },
                            "value": collectionItem.isbn + "|" + "4"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "⭐⭐⭐⭐⭐",
                                "emoji": true
                            },
                            "value": collectionItem.isbn + "|" + "5"
                        }
                    ],
                    "action_id": "collection_item_update_rating"
                },
                {
                    "type": "static_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": collectionItem.lendOut ? "Open to lend out" : "No lending out",
                        "emoji": true
                    },
                    "options": [
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "No lending out",
                                "emoji": true
                            },
                            "value": collectionItem.isbn + "|" + "false"
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "Open to lend out",
                                "emoji": true
                            },
                            "value": collectionItem.isbn + "|" + "true"
                        }
                    ],
                    "action_id": "collection_item_update_lend_out"
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "emoji": true,
                        "text": "Remove from collection"
                    },
                    "style": "danger",
                    "value": collectionItem.isbn,
                    "action_id": "collection_remove_item"
                }
            ])
        }

        if (collectionItem.collectionInfo.ownerCount > 1 && showInteractionOptions) {
            actionElements.push(
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Find other owners",
                        "emoji": true
                    },
                    "value": collectionItem.isbn + "|" + collectionItem.title + "|" + "true", //user owns it
                    "action_id": "collection_item_find_other_ratings"
                }
            )
        }

        let results: any[] = [
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `*${collectionItem.title}*  \n *Author:* ${collectionItem.authorName} \n *ISBN:* ${collectionItem.isbn}` +
                        (collectionItem.collectionInfo.ownerCount > 0 ? "\n Owners in your team: " + collectionItem.collectionInfo.ownerCount : "") +
                        (collectionItem.collectionInfo.avgRating !== 0 ? " \n Average rating in your team: " + "⭐".repeat(Math.round(collectionItem.collectionInfo.avgRating)) : "") +
                        (collectionItem.collectionInfo.lenderCount > 0 ? "\n Potential lenders in your team: " + collectionItem.collectionInfo.lenderCount : "")
                },
                "accessory": {
                    "type": "image",
                    "image_url": `http://covers.openlibrary.org/b/id/${collectionItem.coverId}-M.jpg`,
                    "alt_text": "book cover"
                }
            }
        ]

        if(actionElements.length !== 0){
            results.push(
                {
                    "type": "actions",
                    "elements": actionElements
                }
            )
        }
        return results
    }
}