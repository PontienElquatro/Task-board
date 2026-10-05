export function guideAlreadySeen(metadata:Record<string,unknown>|undefined,cached:boolean):boolean {
 return metadata?.['maat_guide_seen']===true || cached;
}
