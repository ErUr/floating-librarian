export function createPageSelectorBlocks(currentPage: number, numPages: number){
    let options = []
    for (let i = 1; i <= numPages; i++) {
        options.push({
                "text": {
                    "type": "plain_text",
                    "text": i.toString(),
                    "emoji": true
                },
                "value": i.toString()
            })
      }
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "Pages:"
            },
            "accessory":  {
                "type": "static_select",
                "placeholder": {
                    "type": "plain_text",
                    "text": currentPage.toString(),
                    "emoji": true
                },
                "options": options,
                "action_id": "show_home"
            }
        }
    ]
}