/** Keep pending/local states distinct from a confirmed cloud backup. */
export function cloudIndicator(status:string, initializing:boolean, signedIn:boolean, conflict:boolean, sessionError:string) {
 if(initializing)return 'pending';
 if(sessionError || conflict || /indisponible|réessayer|différée|illisible|impossible|conflit|annulée/i.test(status))return 'error';
 if(signedIn && status==='Synchronisé avec votre compte')return 'saved';
 return signedIn?'pending':'local';
}
