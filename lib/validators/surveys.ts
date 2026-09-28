import { z } from 'zod'

// BR-S8: a survey is booked against a property — an existing one, or a new one with an address.
const existingProperty = z.object({ id: z.uuid() })
const newProperty = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    address: z.string().trim().min(5, 'Enter the full address the surveyor will drive to').max(500),
    city_id: z.uuid().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .refine((p) => (p.lat === undefined) === (p.lng === undefined), {
    message: 'Pin both latitude and longitude, or neither',
  })

export const bookSurveySchema = z.object({
  lead_id: z.uuid(),
  surveyor_id: z.uuid({ message: 'Choose a surveyor' }),
  scheduled_at: z.iso.datetime({ offset: true }),
  property: z.union([existingProperty, newProperty]),
})

export type BookSurveyInput = z.infer<typeof bookSurveySchema>
