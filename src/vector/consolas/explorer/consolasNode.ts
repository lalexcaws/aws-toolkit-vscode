/*!
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import * as telemetry from '../../../shared/telemetry/telemetry'
import globals from '../../../shared/extensionGlobals'
import { ConsolasConstants } from '../models/constants'
import {
    createEnableCodeSuggestionsNode,
    createEnterAccessCodeNode,
    createIntroductionNode,
    createAutoSuggestionsNode,
    createRequestAccessNode,
    createOpenReferenceLogNode,
    createSecurityScanNode,
    createRequestAccessNodeCloud9,
} from './consolasChildrenNodes'
import { Commands } from '../../../shared/vscode/commands2'
import { RootNode } from '../../../awsexplorer/localExplorer'
import { Experiments } from '../../../shared/settings'
import { isCloud9 } from '../../../shared/extensionUtilities'
import { Cloud9AccessState } from '../models/model'

export class ConsolasNode implements RootNode {
    public readonly id = 'consolas'
    public readonly treeItem = this.createTreeItem()
    public readonly resource = this
    private readonly onDidChangeChildrenEmitter = new vscode.EventEmitter<void>()
    public readonly onDidChangeChildren = this.onDidChangeChildrenEmitter.event
    private readonly onDidChangeVisibilityEmitter = new vscode.EventEmitter<void>()
    public readonly onDidChangeVisibility = this.onDidChangeVisibilityEmitter.event

    constructor() {
        Experiments.instance.onDidChange(async ({ key }) => {
            if (key === 'Consolas') {
                this.onDidChangeVisibilityEmitter.fire()
                const consolasEnabled = await Experiments.instance.isExperimentEnabled('Consolas')
                telemetry.recordAwsExperimentActivation({
                    experimentId: ConsolasConstants.experimentId,
                    experimentState: consolasEnabled ? 'activated' : 'deactivated',
                    passive: false,
                })
            }
        })
    }

    private createTreeItem() {
        const item = new vscode.TreeItem('Consolas (Preview)')
        item.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed
        item.contextValue = 'awsConsolasNode'
        return item
    }

    public refresh(): void {
        this.onDidChangeChildrenEmitter.fire()
    }

    public getChildren() {
        const termsAccepted = globals.context.globalState.get<boolean>(ConsolasConstants.termsAcceptedKey)
        const autoTriggerEnabled =
            globals.context.globalState.get<boolean>(ConsolasConstants.autoTriggerEnabledKey) || false

        if (isCloud9()) {
            const cloud9AccessState = globals.context.globalState.get<number | undefined>(
                ConsolasConstants.cloud9AccessStateKey
            )
            if (cloud9AccessState === undefined) {
                return [createIntroductionNode()]
            } else if (
                cloud9AccessState === Cloud9AccessState.NoAccess ||
                cloud9AccessState === Cloud9AccessState.RequestedAccess
            ) {
                return [createIntroductionNode(), createRequestAccessNodeCloud9()]
            } else {
                if (termsAccepted) {
                    return [createAutoSuggestionsNode(autoTriggerEnabled), createOpenReferenceLogNode()]
                } else {
                    return [createIntroductionNode(), createEnableCodeSuggestionsNode()]
                }
            }
        } else {
            if (globals.context.globalState.get<string | undefined>(ConsolasConstants.accessToken)) {
                if (termsAccepted) {
                    return [
                        createAutoSuggestionsNode(autoTriggerEnabled),
                        createOpenReferenceLogNode(),
                        createSecurityScanNode(),
                    ]
                } else {
                    return [createIntroductionNode(), createEnableCodeSuggestionsNode()]
                }
            } else {
                return [createIntroductionNode(), createEnterAccessCodeNode(), createRequestAccessNode()]
            }
        }
    }

    public async canShow(): Promise<boolean> {
        return await Experiments.instance.isExperimentEnabled('Consolas')
    }
}

export const consolasNode = new ConsolasNode()
export const refreshConsolas = Commands.register('aws.consolas.refresh', consolasNode.refresh.bind(consolasNode))
