export function profileName(metadata:Record<string,unknown>|undefined, fallback='Membre'):string {
 const text=(key:string)=>typeof metadata?.[key]==='string' ? (metadata[key] as string).trim() : '';
 const first=text('first_name'),last=text('last_name');
 const name=(first && last ? first+' '+last : text('full_name') || text('name'));
 return name && !name.includes('@') ? name : fallback;
}
export function profileInitials(name:string):string {
 const parts=name.trim().split(/\s+/).filter(Boolean);
 return (parts.length>1 ? Array.from(parts[0])[0]+Array.from(parts[parts.length-1])[0] : Array.from(parts[0]||'M').slice(0,2).join('')).toLocaleUpperCase('fr');
}
export function profileNames(first:string,last:string) {
 const first_name=first.trim(),last_name=last.trim();
 if(!first_name||!last_name)throw new Error('Renseignez votre prénom et votre nom.');
 if(first_name.length>80||last_name.length>80||/[\r\n@]/.test(first_name+last_name))throw new Error('Le prénom et le nom doivent contenir au maximum 80 caractères chacun, sans adresse email.');
 return {first_name,last_name,full_name:first_name+' '+last_name,name:first_name+' '+last_name};
}
