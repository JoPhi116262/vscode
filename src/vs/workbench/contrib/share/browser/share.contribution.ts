/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { Codicon } from 'vs/base/common/codicons';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { localize } from 'vs/nls';
import { Action2, MenuId, MenuRegistry, registerAction2 } from 'vs/platform/actions/common/actions';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { Severity } from 'vs/platform/notification/common/notification';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { WorkspaceFolderCountContext } from 'vs/workbench/common/contextkeys';
import { Extensions, IWorkbenchContributionsRegistry } from 'vs/workbench/common/contributions';
import { ShareProviderCountContext, ShareService } from 'vs/workbench/contrib/share/browser/shareService';
import { IShareService } from 'vs/workbench/contrib/share/common/share';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';

const targetMenus = [
	MenuId.EditorContextShare,
	MenuId.SCMResourceContextShare,
	MenuId.OpenEditorsContextShare,
	MenuId.EditorTitleContextShare,
	MenuId.MenubarShare,
	// MenuId.EditorLineNumberContext, // todo@joyceerhl add share
	MenuId.ExplorerContextShare
];

class ShareWorkbenchContribution {
	private static SHARE_ENABLED_SETTING = 'workbench.experimental.share.enabled';

	constructor(
		@IShareService private readonly shareService: IShareService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		if (this.configurationService.getValue<boolean>(ShareWorkbenchContribution.SHARE_ENABLED_SETTING)) {
			this.registerActions();
		}
	}

	private registerActions() {
		registerAction2(class ShareAction extends Action2 {
			static readonly ID = 'workbench.action.share';
			static readonly LABEL = localize('share', 'Share...');

			constructor() {
				super({
					id: ShareAction.ID,
					title: { value: ShareAction.LABEL, original: 'Share...' },
					f1: true,
					icon: Codicon.linkExternal,
					precondition: ContextKeyExpr.and(ShareProviderCountContext.notEqualsTo(0), WorkspaceFolderCountContext.notEqualsTo(0)),
					keybinding: {
						weight: KeybindingWeight.WorkbenchContrib,
						primary: KeyMod.Alt | KeyMod.CtrlCmd | KeyCode.KeyS,
					},
					menu: [
						{ id: MenuId.CommandCenter, order: 1000 }
					]
				});
			}

			override async run(accessor: ServicesAccessor, ...args: any[]): Promise<void> {
				const shareService = accessor.get(IShareService);
				const resourceUri = accessor.get(IWorkspaceContextService).getWorkspace().folders[0].uri;
				const clipboardService = accessor.get(IClipboardService);
				const dialogService = accessor.get(IDialogService);
				const urlService = accessor.get(IOpenerService);

				const uri = await shareService.provideShare({ resourceUri }, new CancellationTokenSource().token);
				if (uri) {
					await clipboardService.writeText(uri.toString());
					const result = await dialogService.input(
						{
							type: Severity.Info,
							inputs: [{ type: 'text', value: uri.toString() }],
							message: localize('shareSuccess', 'Copied link to clipboard!'),
							custom: { icon: Codicon.check },
							primaryButton: localize('open link', 'Open Link')
						}
					);
					if (result.confirmed) {
						urlService.open(uri, { openExternal: true });
					}
				}
			}
		});

		const actions = this.shareService.getShareActions();
		for (const menuId of targetMenus) {
			for (const action of actions) {
				// todo@joyceerhl avoid duplicates
				MenuRegistry.appendMenuItem(menuId, action);
			}
		}
	}
}

registerSingleton(IShareService, ShareService, InstantiationType.Delayed);
const workbenchContributionsRegistry = Registry.as<IWorkbenchContributionsRegistry>(Extensions.Workbench);
workbenchContributionsRegistry.registerWorkbenchContribution(ShareWorkbenchContribution, LifecyclePhase.Eventually);