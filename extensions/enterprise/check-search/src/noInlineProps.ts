import * as sourcegraph from 'sourcegraph'
import { isDefined } from '../../../../shared/src/util/types'
import { combineLatestOrDefault } from '../../../../shared/src/util/rxjs/combineLatestOrDefault'
import { flatten } from 'lodash'
import { Subscription, Unsubscribable, from, of } from 'rxjs'
import { map, switchMap, startWith, toArray } from 'rxjs/operators'
import { OTHER_CODE_ACTIONS, MAX_RESULTS, REPO_INCLUDE } from './misc'
import { memoizedFindTextInFiles } from './util'

export function registerNoInlineProps(): Unsubscribable {
    const subscriptions = new Subscription()
    subscriptions.add(startDiagnostics())
    subscriptions.add(sourcegraph.languages.registerCodeActionProvider(['*'], createCodeActionProvider()))
    return subscriptions
}

const ADJUST = 'React.FunctionComponent<'.length

const CODE_NO_INLINE_PROPS = 'NO_INLINE_PROPS'

function startDiagnostics(): Unsubscribable {
    const subscriptions = new Subscription()

    const diagnosticsCollection = sourcegraph.languages.createDiagnosticCollection('demo0')
    subscriptions.add(diagnosticsCollection)
    subscriptions.add(
        from(sourcegraph.workspace.rootChanges)
            .pipe(
                startWith(void 0),
                map(() => sourcegraph.workspace.roots),
                switchMap(async roots => {
                    if (roots.length > 0) {
                        return of([]) // TODO!(sqs): dont run in comparison mode
                    }

                    const results = flatten(
                        await from(
                            memoizedFindTextInFiles(
                                { pattern: 'React\\.FunctionComponent<\\{', type: 'regexp' },
                                {
                                    repositories: {
                                        includes: [REPO_INCLUDE],
                                        type: 'regexp',
                                    },
                                    files: {
                                        // includes: ['^web/src/.*\\.tsx?$'],
                                        excludes: ['page'],
                                        type: 'regexp',
                                    },
                                    maxResults: MAX_RESULTS,
                                }
                            )
                        )
                            .pipe(toArray())
                            .toPromise()
                    )
                    return combineLatestOrDefault(
                        results.map(async ({ uri }) => {
                            const { text } = await sourcegraph.workspace.openTextDocument(new URL(uri))
                            const diagnostics: sourcegraph.Diagnostic[] = flatten(
                                findMatchRanges(text).map(
                                    range =>
                                        ({
                                            message: 'Use named interface Props instead of inline type for consistency',
                                            range,
                                            severity: sourcegraph.DiagnosticSeverity.Information,
                                            code: CODE_NO_INLINE_PROPS,
                                        } as sourcegraph.Diagnostic)
                                )
                            )
                            return [new URL(uri), diagnostics] as [URL, sourcegraph.Diagnostic[]]
                        })
                    ).pipe(map(items => items.filter(isDefined)))
                }),
                switchMap(results => results)
            )
            .subscribe(entries => {
                diagnosticsCollection.set(entries)
            })
    )

    return diagnosticsCollection
}

function createCodeActionProvider(): sourcegraph.CodeActionProvider {
    return {
        provideCodeActions: async (doc, _rangeOrSelection, context): Promise<sourcegraph.CodeAction[]> => {
            const diag = context.diagnostics.find(d => d.code === CODE_NO_INLINE_PROPS)
            if (!diag) {
                return []
            }

            const fixEdits = new sourcegraph.WorkspaceEdit()
            const typeBody = doc.text.slice(doc.offsetAt(diag.range.start), doc.offsetAt(diag.range.end))
            fixEdits.insert(
                new URL(doc.uri),
                new sourcegraph.Position(diag.range.start.line, 0),
                `interface Props ${typeBody}\n\n`
            )
            fixEdits.replace(new URL(doc.uri), diag.range, 'Props')

            const disableRuleEdits = new sourcegraph.WorkspaceEdit()
            disableRuleEdits.insert(
                new URL(doc.uri),
                new sourcegraph.Position(diag.range.start.line, 0),
                '// sourcegraph:ignore-next-line React lint https://sourcegraph.example.com/ofYRz6NFzj\n'
            )

            return [
                {
                    title: 'Extract Props type',
                    edit: fixEdits,
                    diagnostics: flatten(sourcegraph.languages.getDiagnostics().map(([, diagnostics]) => diagnostics)),
                },
                {
                    title: 'Ignore',
                    edit: disableRuleEdits,
                    diagnostics: flatten(sourcegraph.languages.getDiagnostics().map(([, diagnostics]) => diagnostics)),
                },
                ...OTHER_CODE_ACTIONS,
            ]
        },
    }
}

function findMatchRanges(text: string): sourcegraph.Range[] {
    const ranges: sourcegraph.Range[] = []
    for (const [i, line] of text.split('\n').entries()) {
        const pat = /React\.FunctionComponent<(\{[^}]*\})>/gm
        for (let match = pat.exec(line); !!match; match = pat.exec(line)) {
            ranges.push(new sourcegraph.Range(i, match.index + ADJUST, i, match.index + match[0].length - 1))
        }
    }
    return ranges
}