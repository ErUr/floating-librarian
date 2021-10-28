/**
 * Represents a book within the collection of a specific user
 */
type CollectionItem = {
    teamId: string                     //Slack teamId of the owner of this item
    memberId: string                   //Slack memberId of the owner of this item
    isbn: string
    title: string
    authorName: string
    coverId: string | null             //cover ID to be used to retrieve images from the OpenLibrary covers API https://openlibrary.org/dev/docs/api/covers
    rating: number                     //star rating from 1 to 5, 0 signifying "No rating"
    lendOut: boolean                   //Indicates whether the user would lend out the book
    totalCount: number                 //Total amount of books in the collection of the owner of this book - TODO: improve design, reduce redundancy by pulling it out into a containing structure
    collectionInfo: ItemCollectionInfo // metadata
}

/**
 * Analog to CollectionItem type but without extra ISBN reference
 */
type ItemCollectionInfo = {
    ownerCount: number //number of owners of the book in a team
    lenderCount: number //number of owners who would lend the book out
    avgRating: number //average rating of all team members who gave a rating (1-5) - excluding those who rated with 0 ("No rating")
}