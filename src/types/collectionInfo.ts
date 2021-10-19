/**
 * Represents metadata about a book in a teams collection
 */
type CollectionInfo = {
    isbn: string
    ownerCount: number  //number of owners of the book in a team
    lenderCount: number //number of owners who would lend the book out
    avgRating: number   //average rating of all team members who gave a rating (1-5) - excluding those who rated with 0 ("No rating")
}