import asyncio
import websockets
import json
from datetime import datetime
from pymongo import MongoClient

# =========================
# MONGODB CONNECTION
# =========================
client = MongoClient("mongodb://localhost:27017/")
db = client["chat_app"]
conversations = db["conversations"]
users_col = db["users"]

# =========================
# ONLINE USERS (IN-MEMORY)
# =========================
online_users = {}  # username -> websocket

# =========================
# HELPERS
# =========================
def get_conversation(user1, user2):
    convo = conversations.find_one({
        "users": {"$all": [user1, user2]}
    })
    if not convo:
        convo = {
            "users": [user1, user2],
            "messages": []
        }
        conversations.insert_one(convo)
    return convo

async def broadcast_users():
    all_users = [u["username"] for u in users_col.find({}, {"_id": 0})]
    online = list(online_users.keys())

    data = json.dumps({
        "type": "users",
        "all": all_users,
        "online": online
    })

    for ws in online_users.values():
        await ws.send(data)

# =========================
# WEBSOCKET HANDLER
# =========================
async def handler(websocket):
    try:
        username = await websocket.recv()
        online_users[username] = websocket

        # Store user permanently
        users_col.update_one(
            {"username": username},
            {"$set": {"username": username}},
            upsert=True
        )

        print(f"{username} connected")
        await broadcast_users()

        async for msg in websocket:
            if msg.startswith("TO|"):
                _, receiver, text = msg.split("|", 2)
                now = datetime.now()
                time = now.strftime("%H:%M")
                date = now.strftime("%Y-%m-%d")


                convo = get_conversation(username, receiver)

                message = {
                "from": username,
                "text": text,
                "time": time,
                "date": date
                }


                conversations.update_one(
                    {"_id": convo["_id"]},
                    {"$push": {"messages": message}}
                )

                if receiver in online_users:
                    await online_users[receiver].send(json.dumps({
                        "type": "message",
                        "from": username,
                        "message": text,
                        "time": time
                    }))

            elif msg.startswith("HISTORY|"):
                _, other = msg.split("|", 1)
                convo = get_conversation(username, other)
                await websocket.send(json.dumps({
                    "type": "history",
                    "with": other,
                    "messages": convo["messages"]
                }))

    except Exception as e:
        print("Error:", e)

    finally:
        online_users.pop(username, None)
        await broadcast_users()
        print(f"{username} disconnected")

# =========================
# START SERVER
# =========================
async def main():
    print("🚀 Server running on port 5000")
    async with websockets.serve(handler, "0.0.0.0", 5000):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())





# import asyncio
# import websockets
# import json
# from datetime import datetime
# from pymongo import MongoClient

# # =========================
# # MONGODB CONNECTION
# # =========================
# client = MongoClient("mongodb://localhost:27017/")
# db = client["chat_app"]
# conversations = db["conversations"]

# # =========================
# # IN-MEMORY ONLINE USERS
# # =========================
# users = {}  # username -> websocket

# # =========================
# # HELPERS
# # =========================
# def get_conversation(user1, user2):
#     convo = conversations.find_one({
#         "users": {"$all": [user1, user2]}
#     })

#     if not convo:
#         convo = {
#             "users": [user1, user2],
#             "messages": []
#         }
#         conversations.insert_one(convo)

#     return convo

# async def broadcast_users():
#     data = json.dumps({
#         "type": "users",
#         "users": list(users.keys())
#     })
#     for ws in users.values():
#         await ws.send(data)

# # =========================
# # WEBSOCKET HANDLER
# # =========================
# async def handler(websocket):
#     try:
#         username = await websocket.recv()
#         users[username] = websocket
#         print(f"{username} connected")

#         await broadcast_users()

#         async for msg in websocket:
#             # SEND MESSAGE
#             if msg.startswith("TO|"):
#                 _, receiver, text = msg.split("|", 2)
#                 time = datetime.now().strftime("%H:%M")

#                 convo = get_conversation(username, receiver)

#                 message = {
#                     "from": username,
#                     "text": text,
#                     "time": time
#                 }

#                 conversations.update_one(
#                     {"_id": convo["_id"]},
#                     {"$push": {"messages": message}}
#                 )

#                 # Send to receiver if online
#                 if receiver in users:
#                     await users[receiver].send(json.dumps({
#                         "type": "message",
#                         "from": username,
#                         "message": text,
#                         "time": time
#                     }))

#             # SEND HISTORY
#             elif msg.startswith("HISTORY|"):
#                 _, other = msg.split("|", 1)
#                 convo = get_conversation(username, other)

#                 await websocket.send(json.dumps({
#                     "type": "history",
#                     "with": other,
#                     "messages": convo["messages"]
#                 }))

#     except Exception as e:
#         print("Error:", e)

#     finally:
#         users.pop(username, None)
#         await broadcast_users()
#         print(f"{username} disconnected")

# # =========================
# # START SERVER
# # =========================
# async def main():
#     print("🚀 Server running on port 5000 (MongoDB enabled)")
#     async with websockets.serve(handler, "0.0.0.0", 5000):
#         await asyncio.Future()

# if __name__ == "__main__":
#     asyncio.run(main())
