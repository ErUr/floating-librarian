/**
 * Represents the rating of a book in the collection of a specific user
 * Only used downstream and fetched via teamId, so no reference to the teamId is needed here
 */
type UserRating = {
    memberId: string //Slack memberId of the owner of this item
    rating: number   //star rating from 1 to 5, 0 signifying "No rating"
}