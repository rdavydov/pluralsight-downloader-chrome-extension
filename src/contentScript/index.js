/*global chrome*/
// If your extension doesn't need a content script, just leave this file empty

// This is an example of a script that will run on every page. This can alter pages
// Don't forget to change `matches` in manifest.json if you want to only change specific webpages

import $ from 'jquery'
import { get, sendMessage, sleep } from 'utils'

main()

// This needs to be an export due to typescript implementation limitation of needing '--isolatedModules' tsconfig
export function main() {
	// =================================================================
	// START:VARIABLES
	// =================================================================

	const APPNAME = 'PluralsightCourseDownloader'
	const ROOT_DIRECTORY = 'PluralsightCourseDownloader'

	const INVALID_CHARACTERS = /[/*?<>|']/g
	const DELIMINATOR = '.'
	const EXTENSION = 'mp4'
	const EXTENSION_SUBS = 'vtt'

	const qualities = ['1280x720', '1024x768']

	const DOWNLOAD_TIMEOUT = 3000

	// videoURL to get the actual video URL
	const viewclipURL = 'https://app.pluralsight.com/video/clips/v3/viewclip'
	const subsURL = 'https://app.pluralsight.com/transcript/api/v1/caption/webvtt'

	// STATE variables
	let EXTENSION_ENABLED = false
	let CONTINUE_DOWNLOAD = false

	let CURRENT_SLEEP = null
	let CURRENT_INTERVAL = null

	// =================================================================
	// END:VARIABLES
	// =================================================================

	// ====================================================================
	// START:UTILITIES
	// ====================================================================
	// const sleep = ms =>
	// 	new Promise((resolve) => setTimeout(resolve, ms));

	const updateWaitStats = timeStat => {
		try {
			return asyncInterval(writeTimeStat, timeStat)
		} catch (e) {}
	}

	const writeTimeStat = msStat => {
		let toSec = new Date(msStat).toISOString().slice(14, -5)
		sendMessage({ extensionStatus: `Waiting... ${toSec}` })
	}

	const asyncInterval = (callback, msClear, msInterval = 1000) => {
		let rejector
		let interval
		const prom = new Promise(resolove => {
			rejector = () => resolove()
			interval = setInterval(() => {
				if (msClear > 0) callback(msClear)
				else {
					rejector()
					clearInterval(interval)
				}
				msClear -= msInterval
			}, msInterval)
		})

		prom.abort = () => {
			clearInterval(interval)
			rejector()
		}
		return prom
	}

	const downloadFile = (link, filePath) => {
		return new Promise(resolve => {
			sendMessage(
				{
					action: 'download-sync',
					link: link,
					filePath: filePath,
				},
				response => resolve(response),
			)
		})
	}

	const readSharedValue = async name =>
		new Promise(resolve => get(name, data => (data == null ? resolve() : resolve(data[name]))))

	const readSpeed = () => readSharedValue('speedPercent')

	const readMaxDuration = () => readSharedValue('maxDuration')

	//const readAddedCourses = () => readSharedValue('AddedCourses')

	const readSecondaryLanguageCode = () => readSharedValue('secondaryLanguage')

	const readIsLeadingZeroAlways = async () => {
		let isAlwaysLeadingZero = await readSharedValue('isAlwaysLeadingZero')
		if (isAlwaysLeadingZero === 'true') {
			return true
		}
		return false
	}

	const readCourseType = () => readSharedValue('courseType')

	const log = (message, type = 'STATUS') => console.log(`[${APPNAME}]:[${type}]: ${message}`)

	const replaceQuotesWithSquareBrackets = name => {
		let isFirstQuote = true
		let newName = ''
		for (let i = 0; i < name.length; i++) {
			switch (name[i]) {
				case '"':
					newName += isFirstQuote ? '[' : ']'
					isFirstQuote = !isFirstQuote
					break
				default:
					newName += name[i]
			}
		}
		newName = newName.replace('“', '[')
		newName = newName.replace('”', ']')
		return newName
	}

	const replaceColonsWithHyphen = name => {
		let newName = name[0]
		for (let i = 1; i < name.length - 1; i++) {
			if (name[i - 1] !== ' ' && name[i] === ':' && name[i + 1] !== ' ') {
				newName += '-'
			} else {
				newName += name[i]
			}
		}
		newName += name[name.length - 1]
		newName = newName.replace(':', ' -')
		return newName
	}

	const removeInvalidCharacters = name => {
		let clearedName = replaceQuotesWithSquareBrackets(name)
		clearedName = replaceColonsWithHyphen(clearedName).replace(INVALID_CHARACTERS, '').trim()
		return clearedName
	}

	const getCurrentVideoId = () => {
		const vIdMatch = window.location.search.match('clipId=?([0-9a-f-]*)')
		return vIdMatch ? vIdMatch[1] : null
	}

	// ====================================================================
	// END:UTILITIES
	// ====================================================================

	const getQuality = async () => {
		const courseType = await readCourseType()
		return courseType === 'Old' ? qualities[1] : qualities[0]
	}

	const getDirectoryName = (sectionIndex, sectionName, bPadding = false) => {
		let padIndex = `${sectionIndex + 1}`
		if (bPadding) {
			padIndex = padIndex.padStart(2, '0')
		}
		return removeInvalidCharacters(`${padIndex}${DELIMINATOR} ${sectionName}`)
	}

	const getFileName = (videoIndex, videoName, bPadding = false) => {
		let padIndex = `${videoIndex + 1}`
		if (bPadding) {
			padIndex = padIndex.padStart(2, '0')
		}
		return removeInvalidCharacters(`${padIndex}${DELIMINATOR} ${videoName}`)
	}

	const getVideoURL = async videoId => {
		try {
			const quality = await getQuality()
			const response = await fetch(viewclipURL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-team': 'video-services',
				},
				body: JSON.stringify({
					clipId: videoId,
					mediaType: EXTENSION,
					quality: quality,
					online: true,
					boundedContext: 'course',
					versionId: '',
				}),
			})

			const json = await response.json()
			return json.urls[0].url
		} catch (error) {
			return error
		}
	}

	const getSubtitleURL = async (videoId, versionId, languageCode = 'en') => {
		return subsURL + '/' + videoId + '/' + versionId + '/' + languageCode + '/'
	}

	const getPlaylistPath = (courseName, authorName) => {
		try {
			return getCourseRootPath(courseName, authorName) + '\\playlist.m3u8'
		} catch (error) {
			return error
		}
	}

	const getExercisePath = (courseName, authorName) => {
		try {
			return getCourseRootPath(courseName, authorName) + '\\exercise.zip'
		} catch (error) {
			return error
		}
	}

	const getCourseRootPath = (courseName, authorName) => {
		try {
			const rootDirectory = ROOT_DIRECTORY
			const courseDirectory =
				authorName !== undefined ? `${courseName} By ${authorName}`.trim() : `${courseName}`.trim()

			return `${rootDirectory}\\${courseDirectory}`.replace(/(\r\n|\n|\r)/gm, '')
		} catch (error) {
			return error
		}
	}

	const getFilePath = (
		courseName,
		authorName,
		sectionIndex,
		sectionName,
		videoIndex,
		videoName,
		extension,
		addPadding,
		forPlaylist = false,
	) => {
		try {
			const sectionDirectory = getDirectoryName(sectionIndex, sectionName, addPadding)
			const fileName = getFileName(videoIndex, videoName, addPadding)

			let filePath = `${sectionDirectory}\\${fileName}.${extension}`
			if (!forPlaylist) {
				let courseRootPath = getCourseRootPath(courseName, authorName)
				filePath = `${courseRootPath}\\${filePath}`
			}

			return filePath.replace(/(\r\n|\n|\r)/gm, '')
		} catch (error) {
			return error
		}
	}

	const downloadVideo = async (videoURL, filePath) => {
		try {
			await downloadFile(videoURL, filePath)
			//log(response.actionStatus)
		} catch (error) {
			return error
		}
	}

	const downloadSubs = async (subsURL, filePath) => {
		try {
			await downloadFile(subsURL, filePath)
			//log(response.actionStatus)
		} catch (error) {
			return error
		}
	}

	const printTimeStats = async (courseJSON, startingVideoId) => {
		let stat = await getCourseStats(courseJSON, startingVideoId)

		let friendlyTtl = new Date(stat.timeTotal * 1000).toISOString().substr(11, 8)
		let friendlyTfn = new Date(stat.timeFromNow * 1000).toISOString().substr(11, 8)
		let friendlyTfnDl = new Date(stat.timeDownloading * 1000).toISOString().substr(11, 8)

		console.log(`Total course time: ${friendlyTtl}`)
		console.log(`Time remaining: ${friendlyTfn}`)
		console.log(`Time remaining downloading: ${friendlyTfnDl}`)
	}

	let video_to_download = []

	const getCourseStats = async (courseJSON, startingVideoId) => {
		let timeFromNow = 0
		let timeTotal = 0
		try {
			const { authors, modules: sections } = courseJSON

			let authorName = authors[0].displayName != null ? authors[0].displayName : authors[0].authorHandle
			if (authorName == null) authorName = 'noName'

			// download all videos when no startid was given
			let startToggle = startingVideoId == null || startingVideoId === ''

			video_to_download = []

			for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
				const { contentItems: sectionItems } = sections[sectionIndex]

				for (let videoIndex = 0; videoIndex < sectionItems.length; videoIndex++) {
					if (!CONTINUE_DOWNLOAD) {
						CONTINUE_DOWNLOAD = false
						log('Downloading stopped!!!')
						return
					}

					const { id: videoId, duration } = sectionItems[videoIndex]

					timeTotal += duration

					if (!startToggle) {
						if (videoId === startingVideoId) {
							startToggle = true
						}
					}

					if (!startToggle) {
						continue
					}

					video_to_download.push(videoId)

					timeFromNow += duration
				}
			}

			sendMessage({
				action: 'badge',
				text: `${video_to_download.length}`,
			})
		} catch (error) {
			log(error, 'ERROR')
			return error
		}

		const speed = await readSpeed()

		let timeDownloading = (speed / 100) * timeFromNow

		return { timeFromNow, timeTotal, timeDownloading }
	}

	const downloadPlaylist = async courseJSON => {
		try {
			const { title: courseName, authors, modules: sections } = courseJSON

			let playlistLines = []

			let authorName = authors[0].displayName != null ? authors[0].displayName : authors[0].authorHandle
			if (authorName == null) authorName = 'noName'

			for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
				const { title: sectionName, contentItems: sectionItems } = sections[sectionIndex]

				for (let videoIndex = 0; videoIndex < sectionItems.length; videoIndex++) {
					const { title: videoName } = sectionItems[videoIndex]

					const isLeadingZeroAlways = await readIsLeadingZeroAlways()
					const filePath = getFilePath(
						removeInvalidCharacters(courseName),
						removeInvalidCharacters(authorName),
						sectionIndex,
						removeInvalidCharacters(sectionName),
						videoIndex,
						removeInvalidCharacters(videoName),
						`${EXTENSION}`,
						isLeadingZeroAlways || sectionItems.length > 9,
						true,
					)

					playlistLines.push(filePath)
				}
			}

			let playlistText = playlistLines.join('\n')
			let playlistPath = getPlaylistPath(removeInvalidCharacters(courseName), removeInvalidCharacters(authorName))

			await downloadPlaylistText(playlistText, playlistPath)
		} catch (error) {
			log(error, 'ERROR')
			sendMessage({ extensionStatus: 'Stopped' })
			return error
		}
	}

	const downloadPlaylistText = async (playlistText, path) => {
		let playlistBlob = new Blob([playlistText], {
			type: 'audio/x-mpegurl',
		})

		var url = window.URL.createObjectURL(playlistBlob)
		await downloadFile(url, path)
	}

	function removeDownloadItem(item) {
		if (!video_to_download.includes(item)) return

		var idx = video_to_download.indexOf(item)
		video_to_download.splice(idx, 1)

		sendMessage({
			action: 'badge',
			text: `${video_to_download.length}`,
		})
	}

	const downloadCourse = async (courseJSON, startingVideoId) => {
		try {
			const { title: courseName, authors, modules: sections } = courseJSON

			let authorName = authors[0].displayName != null ? authors[0].displayName : authors[0].authorHandle
			if (authorName == null) authorName = 'noName'

			// download all videos when no startid was given
			let startToggle = startingVideoId == null || startingVideoId === ''

			log(`#################### "${courseName} By ${authorName}" ####################`, 'INFO')

			// store the download failed file information to try again after done
			let to_download_again = []
			await getCourseStats(courseJSON, startingVideoId)

			sendMessage({ courseTitle: courseName })

			for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
				const { title: sectionName, contentItems: sectionItems } = sections[sectionIndex]

				log(`==================== "${sectionName}" ====================`, 'INFO')

				for (let videoIndex = 0; videoIndex < sectionItems.length; videoIndex++) {
					if (!CONTINUE_DOWNLOAD) {
						log('Downloading stopped!!!')
						return
					}

					const { id: videoId, title: videoName, version: versionId, duration } = sectionItems[videoIndex]

					if (!startToggle) {
						if (videoId === startingVideoId) {
							startToggle = true
						}
					}

					if (!startToggle) {
						console.log(`Skipping [${videoId}] ${videoName}`)
						continue
					}

					console.log(`Downloading [${videoId}] ${videoName}`)

					const isLeadingZeroAlways = await readIsLeadingZeroAlways()
					const filePath = getFilePath(
						removeInvalidCharacters(courseName),
						removeInvalidCharacters(authorName),
						sectionIndex,
						removeInvalidCharacters(sectionName),
						videoIndex,
						removeInvalidCharacters(videoName),
						`${EXTENSION}`,
						isLeadingZeroAlways || sectionItems.length > 9,
					)

					const filePath_subs = getFilePath(
						removeInvalidCharacters(courseName),
						removeInvalidCharacters(authorName),
						sectionIndex,
						removeInvalidCharacters(sectionName),
						videoIndex,
						removeInvalidCharacters(videoName),
						`${EXTENSION_SUBS}`,
						isLeadingZeroAlways || sectionItems.length > 9,
					)

					const extensionIndex = filePath_subs.lastIndexOf(`.${EXTENSION_SUBS}`)
					const filePathNoExt_subs = filePath_subs.substring(0, extensionIndex)

					log(`Downloading... "${videoName}"`, 'DOWNLOAD')
					sendMessage({ extensionStatus: 'Downloading...' })

					let exceptionId = 0
					try {
						if (versionId) {
							const subsURL = await getSubtitleURL(videoId, versionId)
							await downloadSubs(subsURL, filePath_subs)
							// Secondary language logic
							const secondaryLangCode = await readSecondaryLanguageCode()
							if (
								secondaryLangCode !== null &&
								secondaryLangCode !== undefined &&
								secondaryLangCode !== '' &&
								secondaryLangCode !== 'none'
							) {
								const langSubsUrl = await getSubtitleURL(videoId, versionId, secondaryLangCode)
								const filePath_subsLang = `${filePathNoExt_subs}.${secondaryLangCode}.vtt`
								await downloadSubs(langSubsUrl, filePath_subsLang)
							}
						}

						//Index to descriminate subs or video
						exceptionId = 1

						const videoURL = await getVideoURL(videoId)
						downloadVideo(videoURL, filePath)
					} catch (error) {
						to_download_again.push({
							expId: exceptionId,
							videoId: videoId,
							verId: versionId,
							filePath: filePath,
							filePath_subs: filePath_subs,
							duration: duration,
						})

						continue
					}

					// Progress Informaton Update on Storage
					sendMessage({
						modulesCompleted: [sectionIndex + 1, sections.length],
						videosCompleted: [videoIndex + 1, sectionItems.length],
						extensionStatus: 'Downloading...',
					})
					removeDownloadItem(videoId)

					// So we dont even want to sleep if we are gonna cancel this run anyways....
					if (!CONTINUE_DOWNLOAD) {
						continue
					}

					sendMessage({ extensionStatus: 'Waiting...' })

					let speed = await readSpeed()
					let maxDuration = await readMaxDuration()
					// Sleep for minimum duration btw the time with percent and the max duration time
					if (maxDuration !== 0) {
						log(`maxDuration: ${maxDuration} duration: ${duration} speed: ${speed}`, 'INFO')
						maxDuration = Math.floor(Math.random() * (maxDuration - Number(speed)) + Number(speed))
						CURRENT_INTERVAL = updateWaitStats(maxDuration * 1000)
						CURRENT_SLEEP = sleep(maxDuration * 1000)
						// CURRENT_INTERVAL = updateWaitStats(Math.min(duration * 10 * speed, maxDuration * 1000))
						// CURRENT_SLEEP = sleep(Math.min(duration * 10 * speed, maxDuration * 1000))
						log(`Sleeping for ${maxDuration} seconds...`, 'INFO')
						await CURRENT_SLEEP
						CURRENT_INTERVAL.abort()
					}
					// Sleep for duration based on a constant updated by speedPercent from extesion browser
					else {
						CURRENT_INTERVAL = updateWaitStats(Math.max(duration * 10 * speed, DOWNLOAD_TIMEOUT))
						CURRENT_SLEEP = sleep(Math.max(duration * 10 * speed, DOWNLOAD_TIMEOUT))
						await CURRENT_SLEEP
						CURRENT_INTERVAL.abort()
					}
				}
			}

			sendMessage({ extensionStatus: 'Retry...' })
			for (let i = to_download_again.length - 1; i >= 0; i--) {
				sendMessage({
					action: 'badge',
					text: `${to_download_again.length}`,
				})

				let fileInfo = to_download_again.shift()
				if (fileInfo.expId === 0) {
					const subsURL = await getSubtitleURL(fileInfo.videoId, fileInfo.verId)
					await downloadSubs(subsURL, fileInfo.filePath_subs)
					// Secondary language logic
					const extensionIndex = fileInfo.filePath_subs.lastIndexOf(`.${EXTENSION_SUBS}`)
					const filePathNoExt_subs = fileInfo.filePath_subs.substring(0, extensionIndex)
					const secondaryLangCode = await readSecondaryLanguageCode()
					if (
						secondaryLangCode !== null &&
						secondaryLangCode != null &&
						secondaryLangCode !== '' &&
						secondaryLangCode !== 'none'
					) {
						const langSubsUrl = await getSubtitleURL(fileInfo.videoId, fileInfo.versionId, secondaryLangCode)
						const filePath_subsLang = `${filePathNoExt_subs}.${secondaryLangCode}.vtt`
						await downloadSubs(langSubsUrl, filePath_subsLang)
					}
				}
				const videoURL = await getVideoURL(fileInfo.videoId)
				downloadVideo(videoURL, fileInfo.filePath)

				let speed = await readSpeed()
				CURRENT_INTERVAL = updateWaitStats(Math.max(fileInfo.duration * 10 * speed, DOWNLOAD_TIMEOUT))
				CURRENT_SLEEP = sleep(Math.max(fileInfo.duration * 10 * speed, DOWNLOAD_TIMEOUT))
				await CURRENT_SLEEP
				CURRENT_INTERVAL.abort()
			}
		} catch (error) {
			log(error, 'ERROR')
			sendMessage({ extensionStatus: 'Errored' })
			return error
		} finally {
			if (CONTINUE_DOWNLOAD) sendMessage({ extensionStatus: 'Finished' })
			else sendMessage({ extensionStatus: 'Cancelled' })

			log('Downloading finished!!!')
			//confirm("Downloading finished");

			video_to_download = []
			sendMessage({ action: 'badge', text: `` })

			CONTINUE_DOWNLOAD = false
		}
	}

	chrome.runtime.onMessage.addListener(message => {
		if (typeof message !== 'object') {
			return false
		}

		if (message.action) {
			var e = $.Event('keypress')
			EXTENSION_ENABLED = true

			if (message.action.cmd === 'downloadAll') {
				if (CONTINUE_DOWNLOAD) return

				EXTENSION_ENABLED = true
				e.which = 99 // Character 'a'
			} else if (message.action.cmd === 'downloadCurrent') {
				if (CONTINUE_DOWNLOAD) return

				EXTENSION_ENABLED = true
				e.which = 86 // Character 'a'
			} else if (message.action.cmd === 'addCourse') {
				// must be in downlonding state in advance
				// if (!CONTINUE_DOWNLOAD)
				// 	return;

				e.which = 96 // Character 'a'
			} else if (message.action.cmd === 'skip') {
				CURRENT_SLEEP?.abort()
				return
			} else if (message.action.cmd === 'stop') {
				CONTINUE_DOWNLOAD = false
				e.which = 115 // Character 's'
			}

			$(document).trigger(e)
		}
	})

	const downloadExerciseFiles = async courseJSON => {
		try {
			const { id: courseId, title: courseName, authors } = courseJSON

			let authorName = authors[0].displayName != null ? authors[0].displayName : authors[0].authorHandle
			if (authorName == null) authorName = 'noName'

			let exerciseLinkJson = await (
				await fetch(`https://app.pluralsight.com/learner/user/courses/${courseId}/exercise-files-url`)
			).json()

			let targetPath = getExercisePath(removeInvalidCharacters(courseName), removeInvalidCharacters(authorName))

			await downloadFile(exerciseLinkJson.exerciseFilesUrl, targetPath)
		} catch (error) {
			log(error, 'ERROR')
		}
	}

	// main-function
	$(() => {
		$(document).keypress(async e => {
			console.log(`Keypress: ${e.which}`)

			const cmdToggleEnabled = e.which === 101 || e.which === 69
			const cmdStopDownload = e.which === 115 || e.which === 83
			const cmdDownloadAll = e.which === 99 || e.which === 67 // Download the entire course | key: c
			const cmdDownloadFromNowOn = e.which === 86 || e.which === 118 //key: v
			const cmdPlaylist = e.which === 112 || e.which === 80 // p
			const cmdExerciseFiles = e.which === 120 || e.which === 88 // x
			const cmdTime = e.which === 116 || e.which === 84
			const cmdAddCourse = e.which === 96 || e.which === 65 // add course

			if (cmdToggleEnabled) {
				// Enable/Disabled extension bindings
				!EXTENSION_ENABLED ? log('Enabled the extension bindings.') : log('Disabled the extension bindings.')
				EXTENSION_ENABLED = !EXTENSION_ENABLED
				return
			}

			if (!EXTENSION_ENABLED) {
				return
			}
			if (cmdStopDownload) {
				// KEYPRESS `s`
				// Stops the download the process, it won't stop the current download, it will abort the download of further videos
				log('Stopping the download process...')
				CONTINUE_DOWNLOAD = false
				CURRENT_SLEEP?.abort()

				sendMessage({
					courseTitle: '',
					modulesCompleted: [0, 0],
					videosCompleted: [0, 0],
					extensionStatus: 'Ready...',
				})

				return
			}
			if (cmdExerciseFiles || cmdPlaylist || cmdDownloadAll || cmdDownloadFromNowOn || cmdTime || cmdAddCourse) {
				log('Downloading course ' + (cmdDownloadAll ? 'from the beginning' : 'from now on') + ' ...')
				log('Fetching course information...')

				const courseJSON = JSON.parse($(window.__NEXT_DATA__).text()).props.pageProps.tableOfContents

				if (cmdAddCourse) {
					log('Add Course')
					let addedCourses = []
					chrome.storage.local.get('addedCourses', data => {
						if (data.addedCourses) addedCourses.push.apply(addedCourses, data.addedCourses)

						courseJSON.startingVideoId = null
						addedCourses.push(courseJSON)
						chrome.storage.local.set({ addedCourses: addedCourses })

						sendMessage({ noOfCoursesAdded: addedCourses.length })
					})
					return
				}

				if (cmdDownloadAll || cmdDownloadFromNowOn) {
					log('Downloading course ' + (cmdDownloadAll ? 'from the beginning' : 'from now on') + ' ...')
					log('Fetching course information...')

					CONTINUE_DOWNLOAD = true
					let startingVideoId = cmdDownloadFromNowOn ? getCurrentVideoId() : null
					if (!cmdDownloadFromNowOn) {
						sendMessage({ extensionStatus: 'Downloading...' })
						await downloadPlaylist(courseJSON)
						// you can skip the waiting for exercise download to complete
						CURRENT_SLEEP = downloadExerciseFiles(courseJSON)
						await CURRENT_SLEEP
					}

					await downloadCourse(courseJSON, startingVideoId)

					while (true) {
						let nextCourse = await new Promise(resolve =>
							chrome.storage.local.get('addedCourses', data => {
								if (!data) resolve()
								else {
									let courses = data['addedCourses']
									let dwnCourse = courses.shift()
									chrome.storage.local.set({ addedCourses: courses })

									sendMessage({
										noOfCoursesAdded: courses.length,
									})
									resolve(dwnCourse)
								}
							}),
						)
						if (!nextCourse) {
							sendMessage({ noOfCoursesAdded: 0 })
							break
						}

						log(`Download course : ${nextCourse.title}`)

						CONTINUE_DOWNLOAD = true
						await downloadPlaylist(nextCourse)
						// you can skip the waiting for exercise download to complete
						CURRENT_SLEEP = downloadExerciseFiles(nextCourse)
						await CURRENT_SLEEP
						await downloadCourse(nextCourse, null)
					}
				} else {
					if (cmdPlaylist) {
						sendMessage({ extensionStatus: 'Downloading...' })
						await downloadPlaylist(courseJSON)
						return
					}

					if (cmdExerciseFiles) {
						sendMessage({ extensionStatus: 'Downloading...' })

						CURRENT_SLEEP = downloadExerciseFiles(courseJSON)
						await CURRENT_SLEEP
						return
					}
					if (cmdTime) {
						await printTimeStats(courseJSON, getCurrentVideoId())
						return
					}
				}
			}
		})
	})
}
