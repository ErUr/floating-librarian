const { Pool } = require('pg');
var Sentry = require("@sentry/node");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL + "?sslmode=no-verify"
})
const dbName = "collection_items"
const columns = {
    teamId: "team_id",
    memberId: "member_id",
    isbn: "isbn",
    title: "title",
    authorName: "author_name",
    coverId: "cover_id",
    lendOut: "lend_out",
    rating: "rating"
}
type CollectionDBItem = {
    team_id: string,
    member_id: string,
    isbn: string,
    title: string,
    author_name: string,
    cover_id: string,
    lend_out: boolean,
    rating: number,
    owner_count: number,
    lender_count: number,
    avg_rating: number,
}

function setupSpan(spanName: string): any {
    const transaction = Sentry.getCurrentHub().getScope().getTransaction();
    let span: any = null
    if (transaction) {
        span = transaction.startChild({
            op: "Database",
            description: spanName,
        });
    }
    return span
}

/**
 * Handles all interfacing with a Postgres database, mapping business logic to PostgreSQL
 */
module.exports = {
    /**
     * Creates the required table if it doesn't exist already.
     */
    setup: function () {
        pool.connect((err: Error, client: any, done: any) => {
            if (err) throw err
            client.query(`CREATE TABLE IF NOT EXISTS ${dbName} (
                id SERIAL,
                ${columns.teamId} VARCHAR(20) NOT NULL,
                ${columns.memberId} VARCHAR(20) NOT NULL,
                ${columns.isbn} VARCHAR(13) NOT NULL,
                ${columns.title} VARCHAR(100) NOT NULL,
                ${columns.authorName} VARCHAR(100) NOT NULL,
                ${columns.coverId} VARCHAR(50),
                ${columns.lendOut} BOOLEAN NOT NULL,
                ${columns.rating} SMALLINT NOT NULL
            )`, (err: Error) => {
                done()
                if (err) throw err
            })
        })
        //todo: create indexes once query structure is clear
    },

    /**
     * Retrieves a members collection of books 
     * Limited to 30 results
     * @param teamId: string - teamId of the Slack team
     * @param memberId: string - memberId of the Slack user
     * @returns: Promise<CollectionItem[]> - Items from the users collection - max. 30
     */
    getBookCollection: async function (teamId: string, memberId: string): Promise<CollectionItem[]> {
        const span = setupSpan("Get book collection")

        return new Promise((resolve: any, reject: any) => {
            pool.connect((err: Error, client: any, done: any) => {
                if (err) throw err
                client.query(`
                SELECT * FROM (
                        SELECT 
                            ${columns.isbn}, 
                            COUNT(*) as owner_count, 
                            COUNT(*) FILTER (WHERE ${columns.lendOut} = true) as lender_count, 
                            AVG(${columns.rating}) FILTER (WHERE ${columns.rating} != 0) as avg_rating 
                        FROM ${dbName} 
                        WHERE 
                            ${columns.teamId} = $1 AND 
                            ${columns.isbn} = ANY (SELECT ${columns.isbn} FROM ${dbName} WHERE ${columns.teamId} = $1 AND ${columns.memberId} = $2) 
                        GROUP BY ${columns.isbn}
                ) a 
                INNER JOIN (
                    SELECT * 
                    FROM ${dbName} 
                    WHERE 
                        ${columns.teamId} = $1 AND 
                        ${columns.memberId} = $2
                ) b
                ON a.${columns.isbn} = b.${columns.isbn}
                ORDER BY id DESC LIMIT 30;
                `, [teamId, memberId], (err: Error, res: any) => {
                    done()
                    if (err) throw err
                    const collectionItems = res.rows.map((dbItem: CollectionDBItem): CollectionItem => {
                        return {
                            teamId: dbItem.team_id,
                            memberId: dbItem.member_id,
                            isbn: dbItem.isbn,
                            title: dbItem.title,
                            authorName: dbItem.author_name,
                            coverId: dbItem.cover_id,
                            rating: dbItem.rating,
                            lendOut: dbItem.lend_out,
                            collectionInfo: {
                                ownerCount: dbItem.owner_count,
                                lenderCount: dbItem.lender_count,
                                avgRating: dbItem.avg_rating
                            }
                        }
                    })
                    span?.finish()
                    resolve(collectionItems)
                })
            })
        })
    },

    /**
     * Retrieves user ratings from members of the team specified by teamId for a book specified by isbn, excluding the calling owner, specified by memberId
     * Limited to 30 results
     * @param teamId: string - Slack teamId of the team to search
     * @param memberId: string - Slack memberId of the calling user - will be excluded from results
     * @param isbn: string - ISBN of the book
     * @returns: Promise<UserRating[]> - Ratings of other users - max. 30
     */
    getUserRatings: async function (teamId: string, memberId: string, isbn: string): Promise<UserRating[]> {
        const span = setupSpan("Get user ratings")

        return new Promise((resolve: any, reject: any) => {
            pool.connect((err: Error, client: any, done: any) => {
                if (err) throw err
                client.query(`SELECT ${columns.memberId}, ${columns.rating} FROM ${dbName} WHERE ${columns.teamId} = $1 AND ${columns.memberId} != $2 AND  ${columns.isbn} = $3 ORDER BY ${columns.rating} DESC LIMIT 30;`, [teamId, memberId, isbn], (err: Error, res: any) => {
                    done()
                    if (err) throw err
                    const userRatings: UserRating[] = res.rows.map((dbItem: Partial<CollectionDBItem>): UserRating => {
                        return {
                            memberId: dbItem.member_id!,
                            rating: dbItem.rating!
                        }
                    })
                    span?.finish()
                    resolve(userRatings)
                })
            })
        })
    },

    /**
     * Retrieves members of the team specified by teamId who own the book specified by isbn and are open to lend it out, excluding the calling owner, specified by memberId
     * Limited to 50 results
     * @param teamId: string - Slack teamId of the team to search
     * @param memberId: string - Slack memberId of the calling user - will be excluded from results
     * @param isbn: string - ISBN of the book
     * @returns: Promise<string[]> - List of Slack memberIds of potential lenders
     */
    getPotentialLenders: async function (teamId: string, memberId: string, isbn: string): Promise<string[]> {
        const span = setupSpan("Get potential lenders")

        return new Promise((resolve: any, reject: any) => {
            pool.connect((err: Error, client: any, done: any) => {
                if (err) throw err
                client.query(`SELECT member_id FROM ${dbName} WHERE ${columns.teamId} = $1 AND ${columns.memberId} != $2 AND  ${columns.isbn} = $3 AND ${columns.lendOut} = true LIMIT 50;`, [teamId, memberId, isbn], (err: Error, res: any) => {
                    done()
                    if (err) throw err
                    const users = res.rows.map((dbItem: Partial<CollectionDBItem>): string => dbItem.member_id!)
                    span?.finish()
                    resolve(users)
                })
            })
        })
    },

    /**
     * Retrieves metadata for a number of books specified by isbns from the collection of a team specified by teamId
     * @param teamId: string - Slack teamId of the team to scan
     * @param isbns: string[] - ISBNs of the books to check for
     * @returns: Promise<CollectionInfo[]> - List of items containing meta info like avg rating and number of owners for a specific book each
     */
    getCollectionInfoForBooks: async function (teamId: string, isbns: string[]): Promise<CollectionInfo[]> {
        const span = setupSpan("Get collection info")

        return new Promise((resolve: any) => {
            pool.connect((err: Error, client: any, done: any) => {
                if (err) throw err
                client.query(`
                    SELECT 
                        ${columns.isbn}, 
                        COUNT(*) as owner_count, 
                        COUNT(*) FILTER (WHERE ${columns.lendOut} = true) as lender_count, 
                        AVG(${columns.rating}) FILTER (WHERE ${columns.rating} != 0) as avg_rating 
                    FROM ${dbName} 
                    WHERE 
                        ${columns.teamId} = $1 AND 
                        ${columns.isbn} = ANY($2) 
                    GROUP BY ${columns.isbn};`,
                    [teamId, isbns], (err: Error, res: any) => {
                        done()
                        if (err) throw err
                        let result: CollectionInfo[] = []
                        res.rows.forEach((dbResult: { isbn: string, avg_rating: number, lender_count: number, owner_count: number }) => {
                            result.push({
                                isbn: dbResult.isbn,
                                ownerCount: dbResult.owner_count,
                                lenderCount: dbResult.lender_count,
                                avgRating: dbResult.avg_rating || 0
                            })
                        });
                        span?.finish()
                        resolve(result)
                    })
            })
        })
    },

    /**
     * Adds a book to a users collection
     * Sets the rating and lend-out state which are zero ("Not rated") and false ("No lending out")
     * @param teamId: string - Slack teamId of the user
     * @param memberId: string - Slack memberId of the user
     * @param isbn: string - ISBN of the book
     * @param title: string - Title of the book
     * @param authorName: string - Name of the author of the book
     * @param coverId: string | null - cover id to be used to retrieve a cover image of the book from the OpenLibrary API
     * @returns Promise<void> - nothing or an error
     */
    addBook: async function (teamId: string, memberId: string, isbn: string, title: string, authorName: string, coverId: string | null): Promise<void> {
        const span = setupSpan("Add book")

        return new Promise((resolve: any) => {
            pool.connect((err: Error, client: any, done: any) => {
                if (err) throw err
                client.query(`INSERT INTO ${dbName} (${columns.teamId}, ${columns.memberId}, ${columns.isbn}, ${columns.title}, ${columns.authorName}, ${columns.coverId}, ${columns.rating}, ${columns.lendOut}) VALUES ($1, $2, $3, $4, $5, $6, 0, false);`, [teamId, memberId, isbn, title, authorName, coverId], (err: Error) => {
                    done()
                    if (err) throw err
                    span?.finish()
                    resolve()
                })
            })
        })
    },

    /**
     * Removes a book from a users collection
     * @param teamId: string - Slack teamId of the user
     * @param memberId: string - Slack memberId of the user
     * @param isbn: string - ISBN of the book
     * @returns Promise<void> - nothing or an error
     */
    removeBook: async function (teamId: string, memberId: string, isbn: string): Promise<void> {
        const span = setupSpan("Remove book")

        return new Promise((resolve: any) => {
            pool.connect((err: Error, client: any, done: any) => {
                if (err) throw err
                client.query(`DELETE FROM ${dbName} WHERE ${columns.teamId} = $1 AND ${columns.memberId} = $2 AND ${columns.isbn} = $3;`, [teamId, memberId, isbn], (err: Error) => {
                    done()
                    if (err) throw err
                    span?.finish()
                    resolve()
                })
            })
        })
    },

    /**
     * Updates the lend-out state of a users collection item
     * @param teamId: string - Slack teamId of the user 
     * @param memberId: string - Slack memberId of the user 
     * @param isbn: string - ISBN of the book 
     * @param lendOut: boolean - *false* for "No lending out" and *true* for "Open to lend out"
     * @returns Promise<void> - nothing or an error 
     */
    updateLendOut: async function (teamId: string, memberId: string, isbn: string, lendOut: boolean): Promise<void> {
        const span = setupSpan("Update lendOut")

        return new Promise((resolve: any, reject: any) => {
            pool.connect((err: Error, client: any, done: any) => {
                if (err) throw err
                client.query(`UPDATE ${dbName} SET ${columns.lendOut} = $1 WHERE ${columns.teamId} = $2 AND ${columns.memberId} = $3 AND ${columns.isbn} = $4;`, [lendOut, teamId, memberId, isbn], (err: Error) => {
                    done()
                    if (err) throw err
                    span?.finish()
                    resolve()
                })
            })
        })
    },

    /**
     * 
     * @param teamId: string - Slack teamId of the user 
     * @param memberId: string - Slack memberId of the user 
     * @param isbn: string - ISBN of the book 
     * @param rating: number - Rating of the book: 1-5 represent star ratings, 0 implies "No rating" 
     * @returns Promise<void> - nothing or an error 
     */
    updateRating: async function (teamId: string, memberId: string, isbn: string, rating: number): Promise<void> {
        const span = setupSpan("Update rating")

        return new Promise((resolve: any, reject: any) => {
            pool.connect((err: Error, client: any, done: any) => {
                if (err) throw err
                client.query(`UPDATE ${dbName} SET ${columns.rating} = $1 WHERE ${columns.teamId} = $2 AND ${columns.memberId} = $3 AND ${columns.isbn} = $4;`, [rating, teamId, memberId, isbn], (err: Error) => {
                    done()
                    if (err) throw err
                    span?.finish()
                    resolve()
                })
            })
        })
    }
}