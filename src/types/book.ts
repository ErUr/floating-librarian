/**
 * Represents a book - only used for API results
 */
type Book = {
    title: string
    authorName: string
    isbn: string
    coverId: string | null //cover ID to be used to retrieve images from the OpenLibrary covers API https://openlibrary.org/dev/docs/api/covers
}