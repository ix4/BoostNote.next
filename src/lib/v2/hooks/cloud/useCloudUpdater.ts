import { useCallback } from 'react'
import shortid from 'shortid'
import {
  archiveDoc,
  ArchiveDocResponseBody,
  createDoc,
  CreateDocRequestBody,
  CreateDocResponseBody,
  destroyDoc,
  DestroyDocResponseBody,
  unarchiveDoc,
  updateDoc,
  updateDocEmoji,
  UpdateDocRequestBody,
  UpdateDocResponseBody,
} from '../../../../cloud/api/teams/docs'
import {
  createDocBookmark,
  CreateDocBookmarkResponseBody,
  destroyDocBookmark,
  DestroyDocBookmarkResponseBody,
} from '../../../../cloud/api/teams/docs/bookmarks'
import {
  createFolder,
  CreateFolderRequestBody,
  CreateFolderResponseBody,
  destroyFolder,
  DestroyFolderResponseBody,
  updateFolder,
  UpdateFolderEmojiResponseBody,
  UpdateFolderRequestBody,
  UpdateFolderResponseBody,
  updateFolderEmoji,
} from '../../../../cloud/api/teams/folders'
import {
  createFolderBookmark,
  CreateFolderBookmarkResponseBody,
  destroyFolderBookmark,
  DestroyFolderBookmarkResponseBody,
} from '../../../../cloud/api/teams/folders/bookmarks'
import {
  destroyWorkspace,
  DestroyWorkspaceResponseBody,
} from '../../../../cloud/api/teams/workspaces'
import { SerializedDoc } from '../../../../cloud/interfaces/db/doc'
import { SerializedFolder } from '../../../../cloud/interfaces/db/folder'
import { SerializedTeam } from '../../../../cloud/interfaces/db/team'
import { useRouter } from '../../../../cloud/lib/router'
import { useNav } from '../../../../cloud/lib/stores/nav'
import { usePage } from '../../../../cloud/lib/stores/pageStore'
import {
  getDocURL,
  getFolderURL,
  getTeamURL,
} from '../../../../cloud/lib/utils/patterns'
import { DialogIconTypes, useDialog } from '../../stores/dialog'
import { useToast } from '../../stores/toast'
import { getMapFromEntityArray } from '../../utils/array'
import useBulkApi from '../useBulkApi'

export function useCloudUpdater() {
  const { pageDoc, pageFolder, setPartialPageData } = usePage()
  const {
    updateWorkspacesMap,
    updateFoldersMap,
    updateDocsMap,
    removeFromWorkspacesMap,
    foldersMap,
    docsMap,
    removeFromDocsMap,
    removeFromFoldersMap,
    setCurrentPath,
  } = useNav()
  const { pushMessage } = useToast()
  const { messageBox } = useDialog()
  const { push } = useRouter()

  const { sendingMap, send } = useBulkApi()

  const createDocApi = useCallback(
    async (
      team: SerializedTeam,
      body: CreateDocRequestBody,
      afterSuccess?: () => void
    ) => {
      await send(shortid.generate(), 'create', {
        api: () => createDoc({ id: team.id }, body),
        cb: (res: CreateDocResponseBody) => {
          updateDocsMap([res.doc.id, res.doc])
          push(
            {
              pathname: `${getTeamURL(team)}${getDocURL(res.doc)}`,
            },
            { new: true }
          )
          if (afterSuccess != null) {
            afterSuccess()
          }
        },
      })
    },
    [push, send, updateDocsMap]
  )

  const createFolderApi = useCallback(
    async (
      team: SerializedTeam,
      body: CreateFolderRequestBody,
      afterSuccess?: () => void
    ) => {
      await send(shortid.generate(), 'create', {
        api: () => createFolder(team, body),
        cb: (res: CreateFolderResponseBody) => {
          updateFoldersMap([
            res.folder.id,
            {
              ...res.folder,
              childDocsIds: [],
              childFoldersIds: [],
            },
          ])
          push(`${getTeamURL(team)}${getFolderURL(res.folder)}`)
          if (afterSuccess != null) {
            afterSuccess()
          }
        },
      })
    },
    [push, send, updateFoldersMap]
  )

  const toggleDocArchive = useCallback(
    async (teamId: string, docId: string, archivedAt?: string) => {
      await send(docId, 'archive', {
        api: () => {
          if (archivedAt == null) {
            return archiveDoc(teamId, docId)
          } else {
            return unarchiveDoc(teamId, docId)
          }
        },
        cb: (res: ArchiveDocResponseBody) => {
          updateDocsMap([res.doc.id, res.doc])
          if (pageDoc != null && res.doc.id === pageDoc.id) {
            setPartialPageData({ pageDoc: res.doc })
          }
        },
      })
    },
    [pageDoc, send, setPartialPageData, updateDocsMap]
  )

  const toggleDocBookmark = useCallback(
    async (teamId: string, docId: string, bookmarked: boolean) => {
      await send(docId, 'bookmark', {
        api: () => {
          if (bookmarked) {
            return destroyDocBookmark(teamId, docId)
          } else {
            return createDocBookmark(teamId, docId)
          }
        },
        cb: (
          res: CreateDocBookmarkResponseBody | DestroyDocBookmarkResponseBody
        ) => {
          updateDocsMap([res.doc.id, res.doc])
          if (pageDoc != null && res.doc.id === pageDoc.id) {
            setPartialPageData({ pageDoc: res.doc })
          }
        },
      })
    },
    [pageDoc, send, setPartialPageData, updateDocsMap]
  )

  const toggleFolderBookmark = useCallback(
    async (teamId: string, id: string, bookmarked: boolean) => {
      await send(id, 'bookmark', {
        api: () => {
          if (bookmarked) {
            return destroyFolderBookmark(teamId, id)
          } else {
            return createFolderBookmark(teamId, id)
          }
        },
        cb: (
          res:
            | CreateFolderBookmarkResponseBody
            | DestroyFolderBookmarkResponseBody
        ) => {
          updateFoldersMap([res.folder.id, res.folder])
          if (pageFolder != null && res.folder.id === pageFolder.id) {
            setPartialPageData({ pageFolder: res.folder })
          }
        },
      })
    },
    [pageFolder, send, setPartialPageData, updateFoldersMap]
  )

  const deleteWorkspace = useCallback(
    async (workspace: { id: string; teamId: string; default: boolean }) => {
      if (workspace.default) {
        return
      }
      messageBox({
        title: `Delete the workspace?`,
        message: `Are you sure to delete this workspace? You will not be able to revert this action.`,
        buttons: [
          {
            variant: 'secondary',
            label: 'Cancel',
            cancelButton: true,
            defaultButton: true,
          },
          {
            variant: 'danger',
            label: 'Destroy All',
            onClick: async () => {
              await send(workspace.id, 'delete', {
                api: () =>
                  destroyWorkspace(
                    { id: workspace.teamId } as any,
                    workspace,
                    true
                  ),
                cb: ({ publicWorkspace }: DestroyWorkspaceResponseBody) => {
                  removeFromWorkspacesMap(workspace.id)
                  pushMessage({
                    title: 'Success',
                    type: 'success',
                    description: 'Your workspace has been deleted',
                  })

                  const workspaceDocs = [...docsMap.values()].filter(
                    (doc) => doc.workspaceId === workspace.id
                  )
                  const workspaceFolders = [...foldersMap.values()].filter(
                    (folder) => folder.workspaceId === workspace.id
                  )

                  if (publicWorkspace != null) {
                    const changedDocs = workspaceDocs.map((doc) => {
                      doc.workspaceId = publicWorkspace.id
                      return doc
                    })
                    updateDocsMap(...getMapFromEntityArray(changedDocs))
                    const changedFolders = workspaceFolders.map((folder) => {
                      folder.workspaceId = publicWorkspace.id
                      return folder
                    })
                    updateFoldersMap(...getMapFromEntityArray(changedFolders))
                    updateWorkspacesMap([publicWorkspace.id, publicWorkspace])
                  } else {
                    removeFromDocsMap(...workspaceDocs.map((doc) => doc.id))
                    removeFromFoldersMap(
                      ...workspaceFolders.map((doc) => doc.id)
                    )
                  }
                },
              })
            },
          },
        ],
      })
    },
    [
      messageBox,
      docsMap,
      foldersMap,
      pushMessage,
      removeFromDocsMap,
      removeFromFoldersMap,
      send,
      updateDocsMap,
      updateFoldersMap,
      updateWorkspacesMap,
      removeFromWorkspacesMap,
    ]
  )

  const deleteFolder = useCallback(
    async (target: { id: string; pathname: string; teamId: string }) => {
      messageBox({
        title: `Delete ${target.pathname}`,
        message: `Are you sure to remove this folder and delete completely its notes`,
        iconType: DialogIconTypes.Warning,
        buttons: [
          {
            variant: 'secondary',
            label: 'Cancel',
            cancelButton: true,
            defaultButton: true,
          },
          {
            variant: 'danger',
            label: 'Delete',
            onClick: async () => {
              await send(target.id, 'delete', {
                api: () =>
                  destroyFolder({ id: target.teamId }, { id: target.id }),
                cb: ({
                  parentFolder,
                  workspace,
                  docs,
                  docsIds,
                  foldersIds,
                }: DestroyFolderResponseBody) => {
                  foldersIds.forEach((folderId) => {
                    removeFromFoldersMap(folderId)
                  })

                  if (docs == null) {
                    docsIds.forEach((docId) => {
                      removeFromDocsMap(docId)
                    })
                  } else {
                    updateDocsMap(...getMapFromEntityArray(docs))
                  }

                  if (parentFolder != null) {
                    updateFoldersMap([
                      parentFolder.id,
                      {
                        ...parentFolder,
                        childFoldersIds: parentFolder.childFoldersIds.filter(
                          (id) => id !== target.id
                        ),
                      },
                    ])
                  }

                  if (workspace != null) {
                    updateWorkspacesMap([workspace.id, workspace])
                  }
                },
              })
            },
          },
        ],
      })
    },
    [
      messageBox,
      updateFoldersMap,
      removeFromFoldersMap,
      updateDocsMap,
      updateWorkspacesMap,
      removeFromDocsMap,
      send,
    ]
  )

  const deleteDoc = useCallback(
    async (
      target: { id: string; archivedAt?: string; teamId: string },
      title = 'this document'
    ) => {
      messageBox({
        title: `Delete ${title}`,
        message: `Are you sure to remove for good this content?`,
        iconType: DialogIconTypes.Warning,
        buttons: [
          {
            variant: 'secondary',
            label: 'Cancel',
            cancelButton: true,
            defaultButton: true,
          },
          {
            variant: 'danger',
            label: 'Delete',
            onClick: async () => {
              await send(target.id, 'delete', {
                api: () => destroyDoc({ id: target.teamId }, { id: target.id }),
                cb: ({
                  doc,
                  parentFolder,
                  workspace,
                }: DestroyDocResponseBody) => {
                  removeFromDocsMap(target.id)
                  if (parentFolder != null) {
                    updateFoldersMap([parentFolder.id, parentFolder])
                  }
                  if (workspace != null) {
                    updateWorkspacesMap([workspace.id, workspace])
                  }
                  if (doc != null) {
                    updateDocsMap([doc.id, doc])
                  }
                },
              })
            },
          },
        ],
      })
    },
    [
      messageBox,
      updateFoldersMap,
      updateDocsMap,
      updateWorkspacesMap,
      removeFromDocsMap,
      send,
    ]
  )

  const updateFolderApi = useCallback(
    async (target: SerializedFolder, body: UpdateFolderRequestBody) => {
      await send(target.id, 'update', {
        api: () => updateFolder({ id: target.teamId }, target.id, body),
        cb: ({ folders, docs, workspaces }: UpdateFolderResponseBody) => {
          const changedFolders = getMapFromEntityArray(folders)
          updateFoldersMap(...changedFolders)

          const changedDocs = getMapFromEntityArray(docs)
          updateDocsMap(...changedDocs)

          if (workspaces != null) {
            updateWorkspacesMap(...getMapFromEntityArray(workspaces))
          }

          if (pageFolder != null && changedFolders.get(pageFolder.id) != null) {
            setPartialPageData({
              pageFolder: changedFolders.get(pageFolder.id)!,
            })
            setCurrentPath(changedFolders.get(pageFolder.id)!.pathname)
          }

          if (pageDoc != null && changedDocs.get(pageDoc.id) != null) {
            setPartialPageData({ pageDoc: changedDocs.get(pageDoc.id)! })
            setCurrentPath(changedDocs.get(pageDoc.id)!.folderPathname)
          }
        },
      })
    },
    [
      updateFoldersMap,
      pageDoc,
      pageFolder,
      updateDocsMap,
      updateWorkspacesMap,
      setPartialPageData,
      setCurrentPath,
      send,
    ]
  )

  const updateDocApi = useCallback(
    async (target: SerializedDoc, body: UpdateDocRequestBody) => {
      await send(target.id, 'update', {
        api: () => updateDoc(target.teamId, target.id, body),
        cb: ({ folders, doc, workspaces }: UpdateDocResponseBody) => {
          const changedFolders = getMapFromEntityArray(folders)
          updateFoldersMap(...changedFolders)
          updateDocsMap([doc.id, doc])

          if (workspaces != null) {
            updateWorkspacesMap(...getMapFromEntityArray(workspaces))
          }

          if (pageDoc != null && doc.id === pageDoc.id) {
            setPartialPageData({ pageDoc: doc })
            setCurrentPath(doc.folderPathname)
          }
        },
      })
    },
    [
      updateFoldersMap,
      pageDoc,
      updateDocsMap,
      updateWorkspacesMap,
      setPartialPageData,
      setCurrentPath,
      send,
    ]
  )

  const updateDocEmojiApi = useCallback(
    async (target: SerializedDoc, emoji?: string) => {
      await send(target.id, 'emoji', {
        api: () => updateDocEmoji(target, emoji),
        cb: ({ doc }: UpdateDocResponseBody) => {
          updateDocsMap([doc.id, doc])

          if (pageDoc != null && doc.id === pageDoc.id) {
            setPartialPageData({ pageDoc: doc })
          }
        },
      })
    },
    [pageDoc, updateDocsMap, setPartialPageData, send]
  )

  const updateFolderEmojiApi = useCallback(
    async (target: SerializedFolder, emoji?: string) => {
      await send(target.id, 'emoji', {
        api: () => updateFolderEmoji(target, emoji),
        cb: ({ folder }: UpdateFolderEmojiResponseBody) => {
          updateFoldersMap([folder.id, folder])

          if (pageFolder != null && folder.id === pageFolder.id) {
            setPartialPageData({ pageFolder: folder })
          }
        },
      })
    },
    [pageFolder, updateFoldersMap, setPartialPageData, send]
  )

  return {
    sendingMap,
    createDoc: createDocApi,
    createFolder: createFolderApi,
    toggleDocArchive,
    toggleDocBookmark,
    toggleFolderBookmark,
    deleteWorkspace,
    deleteFolder,
    deleteDoc,
    updateFolder: updateFolderApi,
    updateDoc: updateDocApi,
    updateDocEmoji: updateDocEmojiApi,
    updateFolderEmoji: updateFolderEmojiApi,
  }
}
