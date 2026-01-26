# Setup

POST `http://localhost:3000/api/google/webhook/setup`

body of the req : {
    "calendarId" : "c_470f6945fe897ddea72781c6b4107ffff8317c17289f5c37df4b46d79f41b0bb@group.calendar.google.com"
    //barberCalendarId
}

# Get all calendar

GET `http://localhost:3000/api/google/calendars`