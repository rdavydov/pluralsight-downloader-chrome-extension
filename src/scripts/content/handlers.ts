import { pipe } from 'fp-ts/function'
import * as E from 'fp-ts/Either'
import * as TE from 'fp-ts/TaskEither'

import { set } from '~/modules/store'
import { logError } from '~/modules/logging'
import { MESSAGES } from '~/constants/actions'

import { getCourse, getVideoId } from '~/configs/platform/pluralsight/service'
import { addCourse } from '~/modules/history'

export const handleMessage = message => {
  if (typeof message !== 'object') {
    return false
  }

  const { action, payload } = message

  switch (action) {
    case MESSAGES.PARSE_COURSE:
      pipe(
        getCourse(),
        TE.fromEither,
        TE.tapTask(addCourse),
        TE.tapTask(set('course')),
        TE.mapLeft<any, any>(logError),
      )()
      return false
    case MESSAGES.PARSE_VIDEO_ID:
      pipe(
        getVideoId(),
        E.map(set('videoId')),
        E.mapLeft<any, any>(logError),
      )
      return false
    default: return false
  }
}
