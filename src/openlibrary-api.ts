/**
 * Handles request towards the OpenLibrary-API
 * Might be on the edge of their terms of service 
 * TODO: replace before scaling this application
 */
const https = require('https');

type ApiBookResult = {
    title: string,
    author_name: string[] | null,
    isbn: string[] | null,
    cover_i: string | null,
}

type ApiResult = {
    docs: ApiBookResult[]
}

/**
 * Filters out bad items, containing no authors, isbns or titles from the API results and and enforces a limit of 5
 */
function buildSearchResultBookList(bookApiResult: ApiResult): Book[] {
    let authorFilter = (book: ApiBookResult): Boolean => book.author_name !== null && book.author_name !== undefined && book.author_name.length !== 0
    let isbnFilter = (book: ApiBookResult): Boolean => book.isbn !== null && book.isbn !== undefined && book.isbn.length !== 0
    let titleFilter = (book: ApiBookResult): Boolean => book.title !== null && book.title !== undefined

    let filteredBooks = bookApiResult.docs.filter(titleFilter).filter(authorFilter).filter(isbnFilter)
    return filteredBooks.slice(0, 5).map((book: ApiBookResult): Book => {
        return {
            title: book.title,
            authorName: book.author_name![0],
            isbn: book.isbn![0],
            coverId: book.cover_i
        }
    })
}

module.exports = {
    /**
     * Searches the OpenLibrary API for books
     * @param searchString: string - the query for the book search
     * @returns: Book[] - Items representing books
     */
    searchBooks: async function (searchString: string): Promise<Book[]> {
        return new Promise((resolve: any) => {
            const limit = 20 //fetch up to 20 books to be sliced further down later, after filters were applied
            const fields = "title,author_name,cover_i,isbn"
            https.get(`https://openlibrary.org/search.json?q=${encodeURIComponent(searchString)}&fields=${fields}&limit=${limit}`, (res: any) => {
                let data = ''
                res.on('data', (chunk: any) => { data += chunk })

                res.on('end', () => {
                    const apiResult = JSON.parse(data)
                    const books = buildSearchResultBookList(apiResult)
                    resolve(books)
                })
            }).on("error", (err: any) => {
                throw err
            })
        })
    }
}