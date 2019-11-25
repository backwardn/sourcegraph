/**
 * @jest-environment node
 */

import * as GQL from '../../../shared/src/graphql/schema'
import { Driver } from '../../../shared/src/e2e/driver'
import { enableLSIF, uploadDumps } from './util/codeintel'
import { ensureLoggedInOrCreateTestUser } from './util/helpers'
import { ensureTestExternalService, getUser, setUserSiteAdmin } from './util/api'
import { getConfig } from '../../../shared/src/e2e/config'
import { getTestTools } from './util/init'
import { GraphQLClient } from './util/GraphQLClient'
import { testCodeNavigation } from './util/codenav'
import { TestResourceManager } from './util/TestResourceManager'

describe('Code intelligence regression test suite', () => {
    const testUsername = 'test-sg-codeintel'
    const config = getConfig(
        'sudoToken',
        'sudoUsername',
        'gitHubToken',
        'sourcegraphBaseUrl',
        'noCleanup',
        'testUserPassword',
        'keepBrowser',
        'logBrowserConsole',
        'slowMo',
        'headless',
        'keepBrowser',
        'logStatusMessages'
    )
    const testExternalServiceInfo = {
        kind: GQL.ExternalServiceKind.GITHUB,
        uniqueDisplayName: '[TEST] GitHub (codeintel.test.ts)',
    }
    const testRepoSlugs = ['sourcegraph-testing/prometheus-common', 'sourcegraph-testing/prometheus-client-golang']

    let driver: Driver
    let gqlClient: GraphQLClient
    let resourceManager: TestResourceManager
    beforeAll(async () => {
        ;({ driver, gqlClient, resourceManager } = await getTestTools(config))
        resourceManager.add(
            'User',
            testUsername,
            await ensureLoggedInOrCreateTestUser(driver, gqlClient, {
                username: testUsername,
                deleteIfExists: true,
                ...config,
            })
        )
        resourceManager.add(
            'External service',
            testExternalServiceInfo.uniqueDisplayName,
            await ensureTestExternalService(
                gqlClient,
                {
                    ...testExternalServiceInfo,
                    config: {
                        url: 'https://github.com',
                        token: config.gitHubToken,
                        repos: testRepoSlugs,
                        repositoryQuery: ['none'],
                    },
                    waitForRepos: testRepoSlugs.map(slug => 'github.com/' + slug),
                },
                config
            )
        )
        const user = await getUser(gqlClient, testUsername)
        if (!user) {
            throw new Error(`test user ${testUsername} does not exist`)
        }
        await setUserSiteAdmin(gqlClient, user.id, true)
    }, 60 * 1000)
    afterAll(async () => {
        if (!config.noCleanup) {
            await resourceManager.destroyAll()
        }
        if (driver) {
            await driver.close()
        }
    }, 60 * 1000)

    test(
        'Dumps',
        async () => {
            const repoBase = 'github.com/sourcegraph-testing'
            const commonRepo = 'prometheus-common'
            const clientRepo = 'prometheus-client-golang'
            const commonCommit = '287d3e634a1e550c9e463dd7e5a75a422c614505'
            const clientCommit = '333f01cef0d61f9ef05ada3d94e00e69c8d5cdda'

            interface Location {
                path: string
                position: { line: number; character: number }
            }

            const makePath = (repository: string, commit: string, { path, position: { line, character } }: Location) =>
                `/${repoBase}/${repository}@${commit}/-/blob/${path}#L${line}:${character}`

            const commonLocations = [
                { path: 'model/value.go', position: { line: 31, character: 19 } },
                { path: 'model/value.go', position: { line: 78, character: 6 } },
                { path: 'model/value.go', position: { line: 84, character: 9 } },
                { path: 'model/value.go', position: { line: 97, character: 10 } },
                // { path: 'model/value.go', position: { line: 104, character: 31 } }, // TODO
                { path: 'model/value.go', position: { line: 104, character: 10 } },
                { path: 'model/value.go', position: { line: 108, character: 9 } },
                { path: 'model/value.go', position: { line: 137, character: 43 } },
                { path: 'model/value.go', position: { line: 147, character: 10 } },
                // { path: 'model/value.go', position: { line: 150, character: 10 } }, // TODO
                { path: 'model/value.go', position: { line: 163, character: 10 } },
                // { path: 'model/value.go', position: { line: 166, character: 10 } }, // TODO
                { path: 'model/value.go', position: { line: 225, character: 11 } },
                // { path: 'model/value_test.go', position: { line: 133, character: 9 } }, // TODO - doesn't work in second test
                // { path: 'model/value_test.go', position: { line: 137, character: 11 } },
                // { path: 'model/value_test.go', position: { line: 156, character: 10 } },
            ].map(reference => makePath(commonRepo, commonCommit, reference))

            const clientLocations = [
                { path: 'api/prometheus/v1/api.go', position: { line: 41, character: 15 } },
                { path: 'api/prometheus/v1/api.go', position: { line: 70, character: 17 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1119, character: 18 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1123, character: 20 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1127, character: 20 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1131, character: 20 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1135, character: 20 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1139, character: 20 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1143, character: 20 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1147, character: 20 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1151, character: 20 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1155, character: 20 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1159, character: 20 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1163, character: 20 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1167, character: 20 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1171, character: 20 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1175, character: 20 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1179, character: 20 } },
                { path: 'api/prometheus/v1/api_test.go', position: { line: 1197, character: 17 } },
                { path: 'api/prometheus/v1/api_bench_test.go', position: { line: 34, character: 26 } },
                // { path: 'api/prometheus/v1/api_bench_test.go', position: { line: 37, character: 24 } }, // TODO
            ].map(reference => makePath(clientRepo, clientCommit, reference))

            const makeTestCase = (repository: string, commit: string, path: string, line: number) => ({
                repoRev: `${repoBase}/${repository}@${commit}`,
                files: [
                    {
                        path,
                        locations: [
                            {
                                line,
                                token: 'SamplePair',
                                expectedHoverContains: 'SamplePair pairs a SampleValue with a Timestamp.',
                                expectedDefinition: `/${repoBase}/prometheus-common@287d3e634a1e550c9e463dd7e5a75a422c614505/-/blob/model/value.go#L78:6`,
                                expectedReferences: commonLocations.concat(clientLocations),
                            },
                        ],
                    },
                ],
            })

            // await uploadDumps(driver, config, gqlClient, repoBase, [
            //     {
            //         repository: commonRepo,
            //         commit: commonCommit,
            //         root: '/',
            //     },
            //     {
            //         repository: clientRepo,
            //         commit: clientCommit,
            //         root: '/',
            //     },
            // ])

            // await enableLSIF(driver, config)

            await testCodeNavigation(driver, config, [
                makeTestCase(commonRepo, commonCommit, '/model/value.go', 31),
                // makeTestCase(commonRepo, commonCommit, '/model/value_test.go', 133),
                makeTestCase(clientRepo, clientCommit, '/api/prometheus/v1/api.go', 41),
                makeTestCase(clientRepo, clientCommit, '/api/prometheus/v1/api_test.go', 1119),
                // makeTestCase(clientRepo, clientCommit, '/api/prometheus/v1/api_bench_test.go', 34),
            ])
        },
        60 * 1000
    )

    // TODO - test closest commit as well
})
