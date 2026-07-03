// ===========================================
// KFK DATABASE ENGINE
// Part 1 (FINAL)
// ===========================================

(function () {

async function startDatabase(){

    // Firebase Load Hone Ka Wait
    while(!window.db || !window.firestoreFunctions){
        await new Promise(r=>setTimeout(r,100));
    }

    const db = window.db;

    const {
        collection,
        doc,
        getDoc,
        getDocs,
        addDoc,
        setDoc,
        updateDoc,
        deleteDoc,
        onSnapshot,
        query,
        where,
        orderBy,
        limit,
        serverTimestamp
    } = window.firestoreFunctions;


    // ===========================================
    // MAIN OBJECT
    // ===========================================

    window.DB = {};



    class CollectionManager{

        constructor(name){

            this.name=name;

            this.ref=collection(db,name);

        }


        async all(){

            const snap=await getDocs(this.ref);

            return snap.docs.map(d=>({

                id:d.id,

                ...d.data()

            }));

        }



        async get(id){

            const snap=await getDoc(doc(db,this.name,id));

            if(!snap.exists()) return null;

            return{

                id:snap.id,

                ...snap.data()

            };

        }



        async add(data){

            data.createdAt=serverTimestamp();

            data.updatedAt=serverTimestamp();

            const ref=await addDoc(this.ref,data);

            return ref.id;

        }



        async set(id,data){

            data.updatedAt=serverTimestamp();

            await setDoc(doc(db,this.name,id),data);

            return true;

        }



        async update(id,data){

            data.updatedAt=serverTimestamp();

            await updateDoc(doc(db,this.name,id),data);

            return true;

        }



        async delete(id){

            await deleteDoc(doc(db,this.name,id));

            return true;

        }



        listen(callback){

            return onSnapshot(this.ref,(snap)=>{

                const rows=[];

                snap.forEach(d=>{

                    rows.push({

                        id:d.id,

                        ...d.data()

                    });

                });

                callback(rows);

            });

        }



        async where(field,operator,value){

            const q=query(

                this.ref,

                where(field,operator,value)

            );

            const snap=await getDocs(q);

            return snap.docs.map(d=>({

                id:d.id,

                ...d.data()

            }));

        }



        async latest(max=20){

            const q=query(

                this.ref,

                orderBy("createdAt","desc"),

                limit(max)

            );

            const snap=await getDocs(q);

            return snap.docs.map(d=>({

                id:d.id,

                ...d.data()

            }));

        }

    }



    // ===========================================
    // Collections
    // ===========================================

    DB.Products=new CollectionManager("products");
    DB.Categories=new CollectionManager("categories");
    DB.Customers=new CollectionManager("customers");
    DB.Orders=new CollectionManager("orders");
    DB.Inventory=new CollectionManager("inventory");
    DB.Homepage=new CollectionManager("homepage");
    DB.Settings=new CollectionManager("settings");
    DB.CRM=new CollectionManager("crm");
    DB.Franchise=new CollectionManager("franchise");
    DB.CloudKitchen=new CollectionManager("cloudKitchen");
    DB.Offers=new CollectionManager("offers");
    DB.Blogs=new CollectionManager("blogs");
    DB.Testimonials=new CollectionManager("testimonials");
    DB.Partners=new CollectionManager("partners");
    DB.Analytics=new CollectionManager("analytics");
    DB.Reports=new CollectionManager("reports");



    console.log("✅ KFK Database Engine Loaded");

}

startDatabase();

})();
