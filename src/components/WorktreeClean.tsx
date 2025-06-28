// TODO: implement clean command
// interface WorktreeCleanProps {
//   yes?: boolean;
// }

// export const WorktreeClean: React.FC<WorktreeCleanProps> = ({
//   yes = false,
// }) => {
//   const [worktrees, setWorktrees] = useState<Worktree[]>([]);
//   const [error, setError] = useState<string | null>(null);
//   const [success, setSuccess] = useState<string[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [removing, setRemoving] = useState(false);

//   useEffect(() => {
//     const initializeClean = async () => {
//       try {
//         setLoading(true);

//         // git fetch --prune origin を実行
//         fetchAndPrune();

//         // worktreeのリストを取得し、PRUNABLE状態を判定
//         const allWorktrees = await getWorktreesWithStatus();
//         const otherWorktrees = allWorktrees.filter(
//           (w) => w.status === 'OTHER'
//         );

//         setWorktrees(otherWorktrees);

//         // --yesオプションが指定されている場合、即座に全て削除
//         if (yes && prunableWorktrees.length > 0) {
//           await removeAllWorktrees(prunableWorktrees);
//         }

//         setLoading(false);
//       } catch (err) {
//         setError(err instanceof Error ? err.message : 'Unknown error');
//         setLoading(false);
//       }
//     };

//     initializeClean();
//   }, [yes]);

//   const removeAllWorktrees = async (worktreesToRemove: Worktree[]) => {
//     setRemoving(true);
//     const removedPaths: string[] = [];
//     const errors: string[] = [];

//     for (const worktree of worktreesToRemove) {
//       try {
//         removeWorktree(worktree.path, true); // forceフラグを使用
//         removedPaths.push(worktree.path);
//       } catch (err) {
//         const errorMsg = err instanceof Error ? err.message : 'Unknown error';
//         errors.push(`${worktree.path}: ${errorMsg}`);
//       }
//     }

//     if (errors.length > 0) {
//       setError(errors.join('\\n'));
//     }

//     if (removedPaths.length > 0) {
//       setSuccess(removedPaths);
//     }

//     setRemoving(false);
//   };

//   const handleConfirm = async (selectedItems: SelectItem[]) => {
//     if (selectedItems.length === 0) {
//       setError('No worktrees selected');
//       return;
//     }

//     const selectedWorktrees = worktrees.filter((w) =>
//       selectedItems.some((item) => item.value === w.path)
//     );

//     await removeAllWorktrees(selectedWorktrees);
//   };

//   const handleCancel = () => {
//     setError('Cancelled');
//   };

//   if (loading) {
//     return (
//       <Box>
//         <Text>Fetching remote changes and analyzing worktrees...</Text>
//       </Box>
//     );
//   }

//   if (success.length > 0) {
//     return (
//       <Box flexDirection="column">
//         <Text color="green">
//           ✓ Successfully cleaned {success.length} worktree(s):
//         </Text>
//         {success.map((path) => (
//           <Text key={path}> {path}</Text>
//         ))}
//       </Box>
//     );
//   }

//   if (error) {
//     return (
//       <Box>
//         <Text color="red">✗ Error: {error}</Text>
//       </Box>
//     );
//   }

//   if (removing) {
//     return (
//       <Box>
//         <Text>Cleaning worktrees...</Text>
//       </Box>
//     );
//   }

//   if (worktrees.length === 0) {
//     return (
//       <Box>
//         <Text>No prunable worktrees found. All worktrees are up to date!</Text>
//       </Box>
//     );
//   }

//   // --yesオプションが指定されている場合、対話なしで削除済み
//   if (yes) {
//     return (
//       <Box>
//         <Text>Cleaning worktrees with --yes option...</Text>
//       </Box>
//     );
//   }

//   const items: SelectItem[] = worktrees.map((worktree) => ({
//     label: `${worktree.branch.padEnd(30)} ${worktree.path}`,
//     value: worktree.path,
//   }));

//   return (
//     <Box flexDirection="column">
//       <Box marginBottom={1}>
//         <Text color="yellow">
//           Found {worktrees.length} prunable worktree(s):
//         </Text>
//       </Box>
//       <MultiSelectList
//         items={items}
//         onConfirm={handleConfirm}
//         onCancel={handleCancel}
//         placeholder="Select worktrees to clean (merged or deleted branches):"
//       />
//     </Box>
//   );
// };
